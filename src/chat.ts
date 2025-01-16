
import * as ai from "ai"; 
import * as stream from "stream/promises";
import * as fs from "fs";
import * as tmp from "tmp";

export type AvailableModels = "gpt-4" | "gpt-4-turbo" | string;

export type PulumiLanguage = "TypeScript" | "JavaScript" | "Python" | "Go" | "C#" | "Java" | "YAML" | "Terraform" | string;

export type ResponseMode = "explain" | "balanced" | "code";

export type ChatRequest = {
    connectionId: string,
    conversationId: string,
    model?: AvailableModels,
    responseMode: ResponseMode,
    instructions: string,
    language: PulumiLanguage,
    version?: string,
};

export type ChatResponse = {
    text: AsyncGenerator<string>,
    conversationId: string,
    connectionId: string,
    version: string,
};

export async function sendPrompt(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch('https://www.pulumi.com/ai/api/chat', {
        method: 'POST',
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'Cookie': `pulumi_web_user_info=j%3A%7B%22userId%22%3A%228246ca93-a5be-45d9-9eda-afba90e47f98%22%2C%22username%22%3A%22eron-pulumi-corp%22%7D`
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        throw new Error('Pulumi Copilot API is unavailable.');
    }

    const versionId = response.headers.get("x-version-id");
    const conversationId = response.headers.get("x-conversation-id");
    const connectionId = response.headers.get("x-connection-id");

    async function* responseStream() {
        const reader = response.body!.getReader();
        const decode = ai.createChunkDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            yield decode(value!);
        }
    }

    return {
        text: responseStream(),
        version: versionId!,
        conversationId: conversationId!,
        connectionId: connectionId!,
    };
}

export type DownloadRequest = {
    conversationId: string,
};

export function templateUrl(conversationId: string): string {
    return `https://www.pulumi.com/ai/api/project/${conversationId}.zip`;
}

export async function downloadToFile(request: DownloadRequest): Promise<string> {
    const response = await fetch(templateUrl(request.conversationId), {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache',
        },
    });
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    
    const zipFile = tmp.fileSync({ prefix: 'pulumi', postfix: '.zip' });
    const zipStream = fs.createWriteStream(zipFile.name, {fd: zipFile.fd});
    try {
        await stream.pipeline(response.body!, zipStream);
    }
    finally {
        zipStream.close();
    }
    return zipFile.name;
}
