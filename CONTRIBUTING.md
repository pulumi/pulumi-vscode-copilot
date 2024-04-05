

# Contributing

## Overview

Visual Studio Code's Copilot Chat architecture enables extension authors to integrate with the [Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) experience. A chat extension is a VS Code extension that uses the [Chat extension API](https://code.visualstudio.com/api/extension-guides/chat) by contributing a _Chat participant_.

This extension provides:
- a chat participant named `@pulumi` to interact with Pulumi AI.
- a `@pulumi /new` chat command to create a new Pulumi project based on the conversation.
- a VSCode command (`pulumi-vscode-copilot.createProject`) to create a project from a template.

The VSCode Chat API is actively under development. See discussion: https://github.com/microsoft/vscode/issues/199908

## System Requirements

- [Visual Studio Code Insiders](https://code.visualstudio.com/insiders/) (v1.88.0+)
- Node 18+

## Running the Extension

1. Open the extension in VSCode Insiders.
2. Using the Run and Debug view, launch the extension using the "Run Extension" launch configuration.
3. In the new window, navigate to the Chat view.
4. Send prompts to the `@pulumi` participant.
5. Set a breakpoint in the chat handler defined in [src/extension.ts](src/extension.ts).

## Publishing
This extension cannot be published to the Marketplace at this time, since it uses a Proposed API.

## Developing
### Updating the Chat API dependencies
One must manaully download updates to the Proposed APIs (see: [vscode-dts](https://github.com/microsoft/vscode/tree/main/src/vscode-dts#vscode-dts)). Here's how:

```
❯ npx vscode-dts dev

Need to install the following packages:
vscode-dts@0.3.3
Ok to proceed? (y) y
npm WARN deprecated vscode-dts@0.3.3: vscode-dts has been renamed to @vscode/dts. Install using @vscode/dts instead.
Downloading vscode.proposed.chatParticipant.d.ts
Downloading vscode.proposed.chatVariableResolver.d.ts
Downloading vscode.proposed.languageModels.d.ts

Read more about proposed API at: https://code.visualstudio.com/api/advanced-topics/using-proposed-api
```

### Using the Pulumi Chat API
Here's how to use the Chat API directly:
```
curl --location 'https://www.pulumi.com/ai/api/chat' \
--header 'Content-Type: application/json' \
--data '{
    "model": "gpt-4-turbo",
    "responseMode": "code",
    "language": "TypeScript",
    "instructions": "A Kubernetes namespace please."
}'
```
