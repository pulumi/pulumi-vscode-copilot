
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as chat from './chat';
import * as winston from 'winston';
import { PULUMIPUS_PARTICIPANT_ID } from './consts';
import { CREATE_PROJECT_COMMAND_ID } from './consts';

interface IPulumiChatResult extends vscode.ChatResult {
    metadata: {
        command?: string;
        conversationId: string,
    }
}

// interface CopilotContext {
//     organizationId: string;
// }

type ChatState = {
    // orgId?: string,
    conversationId: string,
};

// export async function createAgent(context: vscode.ExtensionContext, logger: winston.Logger): Promise<Agent> {
export function activate(context: vscode.ExtensionContext, logger: winston.Logger) {

    // Configure the API client
    const userAgent = `pulumi-vscode-copilot/${context.extension.packageJSON.version}`;
    const tokenProvider = async () => {
        const session = await vscode.authentication.getSession("pulumi", [], { createIfNone: true });
        return session?.accessToken;
    };
    const client = new chat.Client('https://api.pulumi.com/api/ai/chat/preview', userAgent, tokenProvider, logger);

    // create the chat message handler
    const handler = new Handler(logger, client);

    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    const participant = vscode.chat.createChatParticipant(PULUMIPUS_PARTICIPANT_ID, handler.handleRequest.bind(handler));
    participant.iconPath = {
        light: vscode.Uri.joinPath(context.extensionUri, 'avatar-on-white.png'),
        dark: vscode.Uri.joinPath(context.extensionUri, 'avatar-on-black.png')
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
        token: vscode.CancellationToken): Promise<IPulumiChatResult> {

        var chatState = await this.getChatState(context.history);

        // Send prompt to Pulumi Copilot
        this.logger.info(`Sending a request to Pulumi Copilot REST API`, { prompt: request.prompt, conversationId: chatState?.conversationId });
        
        const response = await this.client.sendPrompt({
            state: {
                client: {
                    cloudContext: {
                    orgId: "pulumi",
                    url: "https://app.pulumi.com",
                    },
                },
            },
            conversationId: chatState?.conversationId,
            query: request.prompt ?? "Hello",
        }, token);
        this.logger.info(`Got a response from Pulumi Copilot`, { conversationId: response.conversationId });

        // process each message
        for await (const msg of response.messages.filter(m => m.role === 'assistant')) {
            switch(msg.kind) {
                case 'response':
                    stream.markdown(msg.content);
                    break;
                case 'trace':
                    this.logger.info('Copilot trace message', { content: msg.content });
                    break;
                case 'status':
                    stream.progress(msg.content);
                    break;
                case 'program':
                    const block = "```" + msg.content.language + "\n" + msg.content.code + "\n```";
                    stream.markdown(block);

                    const templateUrl = chat.templateUrl(response.conversationId, msg.content);
                    stream.button({
                        command: CREATE_PROJECT_COMMAND_ID,
                        title: vscode.l10n.t('Create Project'),
                        arguments: [templateUrl]
                    });
                    break;
            }
        }

        return {
            metadata: {
                command: '',
                conversationId: response.conversationId,
            }
        };
    }

    provideFollowups(result: vscode.ChatResult, context: vscode.ChatContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ChatFollowup[]> {

        // for example, given a program response: "convert to another language"
        return [];

        // if (result.metadata?.command === 'new') {
        // 	return [];
        // }
        // return [{
        // 	prompt: "",
        // 	label: vscode.l10n.t('Create a new Pulumi project'),
        // 	command: 'new'
        // } satisfies vscode.ChatFollowup];
    }

    // getChatState recovers the chat state (conversation-id, connection-id) from the chat history
    private async getChatState(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): Promise<ChatState | undefined> {
        const lastResponse = [...history].reverse().find(h => {
            return h instanceof vscode.ChatResponseTurn && h.participant === PULUMIPUS_PARTICIPANT_ID;
        }) as vscode.ChatResponseTurn;
        if (!lastResponse || !lastResponse.result.metadata) {
            return undefined;
        }

        return {
            conversationId: lastResponse.result.metadata.conversationId,
        };
    }
}

