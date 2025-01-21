// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { generatePetname } from 'javascript-petname';
import * as fs from "fs";
import * as winston from 'winston';
import * as agent from './copilot';
import { LogOutputChannelTransport } from 'winston-transport-vscode';
import { CREATE_PROJECT_COMMAND_ID } from './consts';

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

	// Configure Pulumi Copilot as a chat participant.
	agent.activate(context, logger);
	
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

