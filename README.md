# Pulumi Copilot Chat Extension for Visual Studio Code

The extension for chatting with Pulumi Copilot using [Copilot Chat](https://code.visualstudio.com/docs/copilot/copilot-chat) in Visual Studio Code.

Pulumi Copilot is an AI-powered conversational assistant that seamlessly integrates with Pulumi Cloud, helping users:

- Explore and manage cloud infrastructure
- Gain insights into resources, policies, and deployments
- Troubleshoot errors and optimize configurations
- Author and deploy Pulumi IaC more effectively

This extension brings Pulumi Copilot into your IDE to:

- Suggest infrastructure code based on a natural language prompt like "create an AKS cluster in the East US region."
- Answer questions about infrastructure managed by Pulumi like "what is my oldest MySQL DB?" and "has this code been deployed?"
- Translate infrastructure code from other tools (YAML, HCL, JSON, bicep) into programming languages (TypeScript, .NET, Java, Python, Golang)

_Note_: this extension is in public beta. If you have suggestions for features or find bugs, please open an issue.

![Demo](images/docs/copilot_demo.gif)

## System Requirements

- [Visual Studio Code](https://code.visualstudio.com/) (v1.88.0+)

## Features

- A `@pulumi` [chat participant](https://code.visualstudio.com/docs/copilot/getting-started-chat#_use-chat-participants) for GitHub Copilot Chat
- A `/org` command to change the current organization for the conversation.

## Requirements

This extension requires [GitHub Copilot](https://github.com/features/copilot?editor=vscode). To access GitHub Copilot, an active GitHub Copilot license is required. You can read more about GitHub's business and individual offerings at [github.com/features/copilot](https://github.com/features/copilot).

This extension requires a [Pulumi Cloud](http://app.pulumi.com/) account.

## Getting Started

### Install the Extension

1. Get a free Pulumi account at http://app.pulumi.com/.
2. Install and configure [GitHub Copilot](https://code.visualstudio.com/docs/copilot/setup).
3. Install [Pulumi Copilot](https://marketplace.visualstudio.com/items?itemName=pulumi.pulumi-vscode-copilot) using Visual Studio Marketplace.

### Open the Chat View

Open the Chat view and start a conversation with the `@pulumi` chat participant. If you haven't already,
you'll be asked to login to Pulumi Cloud.  You may be asked to select an organization if your Pulumi account
is associated with multiple organizations.

Pulumi Copilot uses local project information and account information to answer questions. Here's some questions to try:

1. "@pulumi whoami" - demonstrates how Copilot uses organization context to answer questions.
2. "@pulumi explain this" - do this with an open file, to see how Copilot understands code references.
3. "@pulumi convert to Pulumi code" - do this with a Terraform configuration or code from another tool.

## Extension Settings

This extension uses various configuration settings from the
[Pulumi Tools](https://marketplace.visualstudio.com/items?itemName=pulumi.pulumi-vscode-copilot) extension.

## Releases

See the [Releases section](https://github.com/pulumi/pulumi-vscode-copilot/releases) for latest release information.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
