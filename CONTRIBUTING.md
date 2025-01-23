

# Contributing

## Overview

Visual Studio Code's Copilot Chat architecture enables extension authors to integrate with the [Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) experience. A chat extension is a VS Code extension that uses the [Chat extension API](https://code.visualstudio.com/api/extension-guides/chat) by contributing a _Chat participant_.

This extension provides:
- a chat participant named `@pulumi` to interact with Pulumi AI.
- a VSCode command (`pulumi-vscode-copilot.createProject`) to create a project from a template.

## System Requirements

- [Visual Studio Code](https://code.visualstudio.com/) (v1.88.0+)
- Node 18+

## Running the Extension

1. Open the extension in VSCode.
2. Using the Run and Debug view, launch the extension using the "Run Extension" launch configuration.
3. In the new window, navigate to the Chat view.
4. Send prompts to the `@pulumi` participant.
5. Set a breakpoint in the chat handler defined in [src/extension.ts](src/extension.ts).

## Publishing
This extension is not yet published to the VSCode Marketplace.
