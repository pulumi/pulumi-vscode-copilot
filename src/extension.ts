// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as chat from './chat';
import { VirtualFS, PosixFS } from '@yarnpkg/fslib';
import { ZipOpenFS } from '@yarnpkg/libzip';
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
		connectionId: string,
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Configure logging.
	const logChannel = vscode.window.createOutputChannel('Pulumi AI', {
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

	// Define a Pulumi chat handler. 
	const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<IPulumiChatResult> => {

		var chatState = getChatState(context.history);

		if (request.command === 'new') {
			// Send prompt to Pulumi AI
			if (request.prompt !== '') {
				stream.progress('Asking Pulumi AI...');
				logger.info(`Sending a request to Pulumi AI`, { prompt: request.prompt, conversationId: chatState?.conversationId });
				const response = await chat.sendPrompt({
					connectionId: chatState?.connectionId || "",
					conversationId: chatState?.conversationId || "",
					responseMode: 'code',
					model: "gpt-4-turbo",
					instructions: request.prompt,
					language: 'TypeScript',
				});
				logger.info(`Got a response from Pulumi AI`, { conversationId: response.conversationId });

				for await (const fragment of response.text) {
					stream.push(new vscode.ChatResponseMarkdownPart(fragment));
				}

				chatState = {
					conversationId: response.conversationId,
					connectionId: response.connectionId,
				};
			} else if (!chatState) {
				throw new Error('Please provide a prompt to create a new project');
			}

			// Download the generated project and respond with a file tree
			// and the option to create a workspace.
			stream.progress('Downloading results...');
			const archivePath = await chat.downloadToFile({ conversationId: chatState.conversationId });
			const archiveUri = vscode.Uri.file(archivePath);
			logger.info(`Downloaded a project template`, { conversationId: chatState.conversationId, path: archivePath });

			stream.markdown(`Here's a Pulumi project template to help you get started: `);
			stream.anchor(vscode.Uri.file(archivePath), 'template.zip');

			await generateFileTree(archiveUri, stream);

			const templateUrl = chat.templateUrl(chatState.conversationId);
			stream.button({
				command: CREATE_PROJECT_COMMAND_ID,
				title: vscode.l10n.t('Create Workspace'),
				arguments: [templateUrl]
			});
			stream.markdown(`When you create the workspace, you'll be prompted for a project name and location.`);

			return {
				metadata: {
					command: 'new',
					connectionId: chatState.connectionId,
					conversationId: chatState.conversationId,
				}
			};

		} else {
			// Send prompt to Pulumi AI
			stream.progress('Asking Pulumi AI...');
			logger.info(`Sending a request to Pulumi AI`, { prompt: request.prompt, conversationId: chatState?.conversationId });
			const response = await chat.sendPrompt({
				connectionId: chatState?.connectionId || "",
				conversationId: chatState?.conversationId || "",
				responseMode: 'balanced',
				model: "gpt-4-turbo",
				instructions: request.prompt,
				language: 'TypeScript',
			});
			logger.info(`Got a response from Pulumi AI`, { conversationId: response.conversationId });

			for await (const fragment of response.text) {
				stream.push(new vscode.ChatResponseMarkdownPart(fragment));
			}

			return {
				metadata: {
					command: '',
					connectionId: response.connectionId,
					conversationId: response.conversationId,
				}
			};
		}
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
			if (result.metadata.command === 'new') {
				return [];
			}
			return [{
				prompt: "",
				label: vscode.l10n.t('Create a new Pulumi project'),
				command: 'new'
			} satisfies vscode.ChatFollowup];
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
		const terminal = vscode.window.createTerminal(`Pulumi AI`);
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
	connectionId: string,
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
		connectionId: lastResponse.result.metadata.connectionId,
	};
}

const zipFS = new PosixFS(
	new VirtualFS({
		baseFs: new ZipOpenFS({
			useCache: true,
			maxOpenFiles: 80,
		}),
	}),
);

// generateFileTree generates a filetree visualization of the archive.
// similar to: https://github.com/microsoft/vscode-copilot-release/issues/1096
async function generateFileTree(fileUri: vscode.Uri, stream: vscode.ChatResponseStream): Promise<void> {
	async function walk(uri: vscode.Uri): Promise<vscode.ChatResponseFileTree[]> {
		const listing = await zipFS.readdirPromise(uri.fsPath);
		const nodes: vscode.ChatResponseFileTree[] = [];
		for (const entry of listing) {
			const entryUri = vscode.Uri.joinPath(uri, entry);
			const entryStat = await zipFS.statPromise(entryUri.fsPath);
			if (entryStat.isDirectory()) {
				const entryChildren = await walk(entryUri);
				nodes.push({ name: entry, children: entryChildren });
			} else {
				nodes.push({ name: entry });
			}
		}
		return nodes;
	}

	const zipUri = vscode.Uri.parse(`zip:${fileUri.fsPath}`);
	const tree = await walk(zipUri);
	stream.filetree(tree, zipUri);
}
