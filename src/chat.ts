
export interface State {
  client: {
    cloudContext: {
      orgId: string;
      url?: string;
    };
  };
}

export interface ChatRequest {
  conversationId?: string;
  query: string;
  state: State;
}

export type StringArray = string[];

export interface TraceMessage {
    kind: "trace";
    role: "assistant" | "user";
    content: string;
}
  
export interface ResponseMessage {
    kind: "response";
    role: "assistant" | "user";
    content: string;
}

export interface StatusMessage {
    kind: "status";
    role: "assistant" | "user";
    content: string;
}

export interface ProgramMessage {
    kind: "program";
    role: "assistant" | "user";
    content: ProgramContent;
}

export interface ProgramContent {
    code: string;
    language: string;
    plan: {
      instructions: string;
      searchTerms: string[];
    };
  }

export type Message = TraceMessage | ResponseMessage | StatusMessage | ProgramMessage;

export interface ChatResponse {
  conversationId: string;
  messages: Message[];
}

export class Client {
    private chatUrl: string;
    private userAgent: string;
    private token: string;

    constructor(chatUrl: string, userAgent: string, accessToken: string) {
        this.chatUrl = chatUrl;
        this.userAgent = userAgent;
        this.token = accessToken;
    }

    async sendPrompt(request: ChatRequest): Promise<ChatResponse> {
        const response = await fetch(this.chatUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${this.token}`,
                'User-Agent': this.userAgent,
            },
            body: JSON.stringify(request)
        });
    
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Pulumi Copilot API is unavailable (${response.statusText}).\n` + text);
        }

        return (await response.json()) as ChatResponse;
    }
}

