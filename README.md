# Pulumi Copilot Chat Extension for Visual Studio Code

The extension for chatting with Pulumi Copilot using VS Code's [Copilot Chat](https://code.visualstudio.com/docs/copilot/copilot-chat) experience.

_Note_: this extension is in public beta. If you have suggestions for features or find bugs, please open an issue.

## System Requirements

- [Visual Studio Code](https://code.visualstudio.com/) (v1.88.0+)

## Features

- A `@pulumi` chat participant for chatting with Pulumi Copilot.
- A `/org` command to change the current organization for the conversation.

## Requirements

This extension requires [GitHub Copilot](https://github.com/features/copilot?editor=vscode). To access GitHub Copilot, an active GitHub Copilot license is required. You can read more about GitHub's business and individual offerings at [github.com/features/copilot](https://github.com/features/copilot).

## Getting Started

### Build and Run The Extension

This extension is not yet published and must be built from source. See [CONTRIBUTING.md#running-the-extension](CONTRIBUTING.md#running-the-extension).

### Open the Chat View

Open the chat view and start a conversation with the `@pulumi` chat participant. Some questions to try:

1. "@pulumi whoami" - demonstrates how Copilot uses organization context to answer questions.
2. "@pulumi explain this" - do this with an open file, to see how Copilot understands code references.

## Extension Settings

## Releases

See the [Releases section](https://github.com/pulumi/pulumi-vscode-copilot/releases) for latest release information.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
