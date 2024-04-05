# Visual Studio Code Copilot Chat Extension

The extension for chatting with Pulumi AI using VS Code's [Copilot Chat](https://code.visualstudio.com/docs/copilot/copilot-chat) experience.

_Note_: this extension is in public beta. If you have suggestions for features or find bugs, please open an issue.

## System Requirements

- [Visual Studio Code Insiders](https://code.visualstudio.com/insiders/) (v1.88.0+)

_Note_: this extension relies on a [Proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api) that is only available in the [Insiders](https://code.visualstudio.com/insiders/) build.
Insiders installs next to the Stable build, allowing you to use either independently.

## Features

- A `@pulumi` chat participant for chatting with Pulumi AI.
- A `/new` command to create Pulumi projects based on a conversation.

https://github.com/pulumi/pulumi-vscode-copilot/assets/1775518/7026776d-f057-4aa4-af99-8d91b52586e8

## Requirements

This extension requires [GitHub Copilot](https://github.com/features/copilot?editor=vscode). To access GitHub Copilot, an active GitHub Copilot license is required. You can read more about GitHub's business and individual offerings at [github.com/features/copilot](https://github.com/features/copilot).

## Getting Started

### Open the Chat View

Open the chat view and start a conversation with the `@pulumi` chat participant. Ask a question like "@pulumi What is Pulumi?".

### Create a Project

Use the `@pulumi /new` chat command to generate a new Pulumi project based on the conversation. Pulumi responds with a file tree showing
a preview of the project. Feel free to refine the program with follow-ups directed to `@pulumi`.

Click "Create Workspace" to proceed to create a Pulumi project into a new folder with the given name. Pulumi opens a new window for the project.

## Extension Settings

## Known Issues

- The extension uses TypeScript as the language for generated code.

## Releases

See the [Releases section](https://github.com/pulumi/pulumi-vscode-copilot/releases) for latest release information.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
