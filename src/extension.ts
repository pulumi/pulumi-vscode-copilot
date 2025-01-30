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
import * as winston from "winston";
import * as agent from "./copilot";
import { LogOutputChannelTransport } from "winston-transport-vscode";
import * as AxiosLogger from "axios-logger";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Configure logging.
  const logChannel = vscode.window.createOutputChannel("Pulumi Copilot", {
    log: true,
  });
  context.subscriptions.push(logChannel);
  const logger = winston.createLogger({
    level: "trace",
    exitOnError: false,
    levels: LogOutputChannelTransport.config.levels,
    format: LogOutputChannelTransport.format(),
    transports: [new LogOutputChannelTransport({ outputChannel: logChannel })],
  });
  AxiosLogger.setGlobalConfig({
    logger: logger.info.bind(logger),
  });

  // Configure Pulumi Copilot as a chat participant.
  agent.activate(context, logger);
}

// This method is called when your extension is deactivated
export function deactivate() {}
