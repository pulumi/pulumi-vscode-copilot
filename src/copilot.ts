// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as chat from "./chat";
import * as winston from "winston";
import * as config from "./config";
import { PULUMIPUS_PARTICIPANT_ID } from "./consts";
import { CREATE_PROJECT_COMMAND_ID } from "./consts";

// metadata to be associated with the response, to be persisted across turns
export interface CopilotChatResult extends vscode.ChatResult {
  metadata: {
    user: chat.User;
    command?: string;
    conversationId?: string;
    orgId?: string;
  };
}

// the current state of a conversation based on the chat history
interface ConversationState {
  user: chat.User;
  orgId?: string;
  conversationId?: string;
};

export class TokenProvider implements chat.AuthenticationTokenProvider {
  private forceNewSession = false;
  private detail?: string;

  async request(): Promise<chat.AuthenticationToken | undefined> {
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

  invalidate(opts?: chat.AuthenticationTokenInvalidateOptions) {
    this.forceNewSession = true;
    this.detail = opts?.detail;
  }
}

export function activate(
  context: vscode.ExtensionContext,
  logger: winston.Logger
) {
  // Configure the API client
  const userAgent = `pulumi-vscode-copilot/${context.extension.packageJSON.version}`;
  const client = new chat.Client(
    config.apiUrl(),
    userAgent,
    new TokenProvider()
  );

  // create the chat message handler
  const handler = new Handler(logger, client);

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
  private readonly client: chat.Client;

  constructor(logger: winston.Logger, client: chat.Client) {
    this.logger = logger;
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
      const userInfo = await this.client.getUserInfo(cancellationToken);
      switch (userInfo.organizations.length) {
        case 0:
          throw new Error("You are not a member of any Pulumi organizations.");
        case 1:
          chatState.orgId = userInfo.organizations[0].name;
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
      stream.markdown(
        `*'${chatState.orgId!}' is now the active organization for this conversation.*\n\n`
      );
    }

    if (!request.prompt) {
      throw new Error(
        vscode.l10n.t(
          "Please specify a question when using this command.\n\nUsage: @pulumi Ask a question about your cloud infrastructure."
        )
      );
    }

    // Send prompt to Pulumi Copilot
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
        query: request.prompt,
      },
      cancellationToken
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
          stream.markdown(msg.content);
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

          const templateUrl = chat.templateUrl(
            response.conversationId,
            msg.content
          );
          stream.button({
            command: CREATE_PROJECT_COMMAND_ID,
            title: vscode.l10n.t("Create Project"),
            arguments: [templateUrl],
          });
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

  /*eslint no-unused-vars: "off"*/
  provideFollowups(
    result: CopilotChatResult,
    context: vscode.ChatContext,
    token: vscode.CancellationToken
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
      const userInfo = await this.client.getUserInfo(cancellationToken);
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
