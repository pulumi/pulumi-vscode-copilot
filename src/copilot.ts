// Copyright 2025, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as api from "./api";
import * as winston from "winston";
import * as config from "./config";
import { PULUMIPUS_PARTICIPANT_ID } from "./consts";

// metadata to be associated with the response, to be persisted across turns
export interface CopilotChatResult extends vscode.ChatResult {
  metadata: {
    user: api.User;
    command?: string;
    conversationId?: string;
    orgId?: string;
  };
}

// the current state of a conversation based on the chat history
interface ConversationState {
  user: api.User;
  orgId?: string;
  conversationId?: string;
};

export class TokenProvider implements api.AuthenticationTokenProvider {
  private forceNewSession = false;
  private detail?: string;

  async request(): Promise<api.AuthenticationToken | undefined> {
    // obtain an access token, interactively if necessary
    const session = await vscode.authentication.getSession("pulumi", [], {
      ...(this.forceNewSession
        ? { forceNewSession: { detail: this.detail } }
        : { createIfNone: true }),
    });
    this.forceNewSession = false;
    if (!session) {
      return undefined;
    }
    return {
      accessToken: session.accessToken,
    };
  }

  invalidate(opts?: api.AuthenticationTokenInvalidateOptions) {
    this.forceNewSession = true;
    this.detail = opts?.detail;
  }
}

export function activate(
  context: vscode.ExtensionContext,
  logger: winston.Logger
) {
  // Configure the API client
  const tokenProvider = new TokenProvider();
  const userAgent = `pulumi-vscode-copilot/${context.extension.packageJSON.version}`;
  let client = new api.Client(config.apiUrl(), userAgent, tokenProvider);

  // create the chat message handler
  const handler = new Handler(logger, client);
  vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration("pulumi.api-url")) {
      client = new api.Client(config.apiUrl(), userAgent, tokenProvider);
      handler.setClient(client);
    }
  });

  // Chat participants appear as top-level options in the chat input
  // when you type `@`, and can contribute sub-commands in the chat input
  // that appear when you type `/`.
  const participant = vscode.chat.createChatParticipant(
    PULUMIPUS_PARTICIPANT_ID,
    handler.handleRequest.bind(handler)
  );
  participant.iconPath = {
    light: vscode.Uri.joinPath(context.extensionUri, "avatar-on-white.png"),
    dark: vscode.Uri.joinPath(context.extensionUri, "avatar-on-black.png"),
  };
  participant.followupProvider = handler;
  context.subscriptions.push(participant);
}

export class Handler implements vscode.ChatFollowupProvider {
  private readonly logger: winston.Logger;
  private client: api.Client;

  constructor(logger: winston.Logger, client: api.Client) {
    this.logger = logger;
    this.client = client;
  }

  public setClient(client: api.Client) {
    this.client = client;
  }

  async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    cancellationToken: vscode.CancellationToken
  ): Promise<CopilotChatResult> {
    const chatState = await this.getChatState(
      context.history,
      cancellationToken
    );

    if (request.command === "org") {
      // set the active organization based on the prompt
      // FUTURE: use language model to determine the organization from the prompt
      let orgId: string | undefined = request.prompt.trim();
      if (!orgId) {
        // clear the active organization
        orgId = undefined;
      } else {
        if (
          !chatState.user.organizations.find((o) => o.githubLogin === orgId)
        ) {
          throw new Error(
            `'${orgId}' is not an organization associated with your account.`
          );
        }
        stream.markdown(
          `*'${orgId}' is now the active organization for this conversation.*\n`
        );
      }
      return {
        metadata: {
          user: chatState.user,
          command: request.command,
          orgId: orgId,
          conversationId: "", // clear the conversation id because a conversation may not span organizations
        },
      };
    }

    if (!chatState.orgId) {
      // we need to select an organization before sending a prompt,
      // because each Pulumi Copilot conversation is tied to a specific organization.
      const userInfo = await this.client.getUserInfo({signal: tokenToSignal(cancellationToken)});
      switch (userInfo.organizations.length) {
        case 0:
          throw new Error("You are not a member of any Pulumi organizations.");
        case 1:
          chatState.orgId = userInfo.organizations[0].githubLogin;
          break;
        default: {
          // present a pick list to select an organization
          const selected = await vscode.window.showQuickPick(
            userInfo.organizations.map(
              (o) =>
                ({
                  id: o.githubLogin,
                  label: o.name,
                  iconPath:
                    o.avatarUrl.length > 0
                      ? vscode.Uri.parse(o.avatarUrl)
                      : undefined,
                }) satisfies vscode.QuickPickItem & { id: string }
            ),
            {
              title: "Select a Pulumi organization",
            }
          );
          if (!selected) {
            throw new Error(
              "Select a Pulumi organization to use Pulumi Copilot."
            );
          }
          chatState.orgId = selected.id;
          break;
        }
      }
    }

    if (!request.prompt) {
      throw new Error(
        vscode.l10n.t(
          "Please specify a question when using this command.\n\nUsage: @pulumi Ask a question about your cloud infrastructure."
        )
      );
    }
    const query = await this.generateQuery(request);
    
    // Send query to Pulumi Copilot
    this.logger.info(`Sending a request to Pulumi Copilot REST API`, {
      prompt: request.prompt,
      orgId: chatState.orgId!,
      conversationId: chatState.conversationId,
    });
    const response = await this.client.sendPrompt(
      {
        state: {
          client: {
            cloudContext: {
              orgId: chatState.orgId!,
              url: config.consoleUrl(),
            },
          },
        },
        conversationId: chatState.conversationId,
        query: query,
      },
      {signal: tokenToSignal(cancellationToken)}
    );
    this.logger.info(`Got a response from Pulumi Copilot`, {
      conversationId: response.conversationId,
    });

    // process each message
    for await (const msg of response.messages.filter(
      (m) => m.role === "assistant"
    )) {
      switch (msg.kind) {
        case "response":
          stream.markdown(msg.content.trim() + "\n\n");
          break;
        case "trace":
          this.logger.info("Copilot trace", { message: msg.content });
          break;
        case "status":
          stream.progress(msg.content);
          break;
        case "program": {
          const block =
            "```" + msg.content.language + "\n" + msg.content.code + "\n```";
          stream.markdown(block);

          // FUTURE: implement template support
          // const templateUrl = api.templateUrl(
          //   response.conversationId,
          //   msg.content
          // );
          // stream.button({
          //   command: CREATE_PROJECT_COMMAND_ID,
          //   title: vscode.l10n.t("Create Project"),
          //   arguments: [templateUrl],
          // });
          break;
        }
      }
    }

    return {
      metadata: {
        user: chatState.user,
        command: "",
        orgId: chatState.orgId,
        conversationId: response.conversationId,
      },
    };
  }

  // generateQuery produces a query string inclusive of the user's prompt and referenced code blocks.
  async generateQuery(request: vscode.ChatRequest): Promise<string> {
    const sb = []
    sb.push(request.prompt);

    const pushCodeBlock = (code: string, location?: string, modelDescription?: string) => {
      sb.push('\n');
      if (modelDescription) {
        sb.push("# " + modelDescription);
      }
      if (location) {
        sb.push("# " + location);
      }
      sb.push('```');
      sb.push(code);
      sb.push('```');
    }

    for (const ref of request.references) {
      if (typeof ref.value === 'string') {
        pushCodeBlock(ref.value, undefined, ref.modelDescription);
      } else if (ref.value instanceof vscode.Uri) {
        const doc = await vscode.workspace.openTextDocument(ref.value);
        pushCodeBlock(doc.getText(), ref.value.toString(), ref.modelDescription);
      } else if (ref.value instanceof vscode.Location) {
        const doc = await vscode.workspace.openTextDocument(ref.value.uri);
        pushCodeBlock(doc.getText(ref.value.range), ref.value.uri.toString(), ref.modelDescription);
      }
    }

    return sb.join("\n")
  }

  provideFollowups(
    result: CopilotChatResult,
    _context: vscode.ChatContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.ChatFollowup[]> {
    if (!result.metadata?.orgId) {
      // return follow-ups to select an organization
      return result.metadata.user.organizations.map(
        (o) =>
          ({
            command: "org",
            prompt: o.githubLogin,
            label: `/org ${o.githubLogin}`,
          }) satisfies vscode.ChatFollowup
      );
    }

    // for example, given a program response, a follow-up might be "convert to another language"
    return [];
  }

  // getChatState recovers the chat state (conversation-id, connection-id) from the chat history
  private async getChatState(
    history: readonly (vscode.ChatRequestTurn | vscode.ChatResponseTurn)[],
    cancellationToken: vscode.CancellationToken
  ): Promise<ConversationState> {
    const lastResponse = [...history].reverse().find((h) => {
      return (
        h instanceof vscode.ChatResponseTurn &&
        h.participant === PULUMIPUS_PARTICIPANT_ID
      );
    }) as vscode.ChatResponseTurn;

    if (!lastResponse || !lastResponse.result.metadata) {
      const userInfo = await this.client.getUserInfo({signal: tokenToSignal(cancellationToken)});
      return {
        user: userInfo,
      };
    }

    const result = lastResponse.result as CopilotChatResult;
    return {
      user: result.metadata.user,
      orgId: result.metadata.orgId,
      conversationId: result.metadata.conversationId,
    };
  }
}

function tokenToSignal(token: vscode.CancellationToken): AbortSignal {
  const abortController = new AbortController();
  token.onCancellationRequested(() => {
    abortController.abort();
  });
  return abortController.signal;
}
