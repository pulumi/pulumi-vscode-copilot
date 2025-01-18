// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as chat from './chat';
import { generatePetname } from 'javascript-petname';
import * as fs from "fs";
import * as winston from 'winston';
import { LogOutputChannelTransport } from 'winston-transport-vscode';

const PULUMIPUS_PARTICIPANT_ID = 'pulumi-vscode-copilot.pulumipus';
const CREATE_PROJECT_COMMAND_ID = 'pulumi-vscode-copilot.createProject';

interface IPulumiChatResult extends vscode.ChatResult {
	metadata: {
		command?: string;
		conversationId: string,
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Configure logging.
	const logChannel = vscode.window.createOutputChannel('Pulumi Copilot', {
		log: true,
	});
	context.subscriptions.push(logChannel);
	const logger = winston.createLogger({
		level: 'trace',
		exitOnError: false,
		levels: LogOutputChannelTransport.config.levels,
		format: LogOutputChannelTransport.format(),
		transports: [new LogOutputChannelTransport({ outputChannel: logChannel })],
	});

	const userAgent = `pulumi-vscode-copilot/${context.extension.packageJSON.version}`;
	
	const settings = vscode.workspace.getConfiguration('pulumi');
	const accessToken = settings.get<string>('accessToken')!;

	const client = new chat.Client('https://api.pulumi.com/api/ai/chat/preview', userAgent, accessToken);

	// Define a Pulumi chat handler. 
	const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<IPulumiChatResult> => {

		var chatState = getChatState(context.history);

		// Send prompt to Pulumi Copilot
		logger.info(`Sending a request to Pulumi Copilot REST API`, { prompt: request.prompt, conversationId: chatState?.conversationId });
		
		const response = await client.sendPrompt({
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
		});
		logger.info(`Got a response from Pulumi Copilot`, { conversationId: response.conversationId });

		// process each message
		for await (const msg of response.messages.filter(m => m.role === 'assistant')) {
			switch(msg.kind) {
				case 'response':
					stream.markdown(msg.content);
					break;
				case 'trace':
					logger.info(msg.content);
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
	};

	// Chat participants appear as top-level options in the chat input
	// when you type `@`, and can contribute sub-commands in the chat input
	// that appear when you type `/`.
	const pulumipus = vscode.chat.createChatParticipant(PULUMIPUS_PARTICIPANT_ID, handler);
	pulumipus.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, 'avatar-on-white.png'),
		dark: vscode.Uri.joinPath(context.extensionUri, 'avatar-on-black.png')
	};
	pulumipus.followupProvider = {
		provideFollowups(result: IPulumiChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
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
	};
	context.subscriptions.push(pulumipus);

	// Define a command to create a new Pulumi project from a template URL.
	context.subscriptions.push(vscode.commands.registerCommand(CREATE_PROJECT_COMMAND_ID, async (templateUri: vscode.Uri) => {

		const projectName = await vscode.window.showInputBox({
			title: 'Select a Pulumi project name',
			value: generatePetname(),
			placeHolder: 'my-project',
			validateInput: text => {
				const valid = /^(?!-)[a-zA-Z0-9-]{1,30}$/i.test(text);
				if (!valid) {
					return 'Invalid project name. Please use only alphanumeric characters and hyphens.';
				}
				return undefined;
			}
		});
		if (!projectName) {
			return;
		}

		const parentUri = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select as Parent Folder',
		}).then(uri => uri?.[0]);
		if (!parentUri) {
			return;
		}
		const workspaceUri = vscode.Uri.joinPath(parentUri, projectName);
		fs.mkdirSync(workspaceUri.fsPath, { recursive: true });

		// run `pulumi new` in a terminal
		const terminal = vscode.window.createTerminal(`Pulumi Copilot`);
		terminal.show(true);
		const cmd = `pulumi new "${templateUri}" -y --name "${projectName}" --dir "${workspaceUri.fsPath}"`;
		terminal.sendText(cmd, true);

		// open the new workspace in a new window
		vscode.commands.executeCommand('vscode.openFolder', workspaceUri, { forceNewWindow: true });
		await vscode.window.showInformationMessage(`The workspace was created.`);
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }

type ChatState = {
	conversationId: string,
};

// getChatState recovers the chat state (conversation-id, connection-id) from the chat history
function getChatState(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): ChatState | undefined {
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
