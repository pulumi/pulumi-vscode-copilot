
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
  templateUrl?: string;
}

export type Message = TraceMessage | ResponseMessage | StatusMessage | ProgramMessage;

export interface ChatResponse {
  conversationId: string;
  messages: Message[];
}


export type TokenProvider = () => Promise<string|undefined>;


export class Client {
    private chatUrl: string;
    private userAgent: string;
    private tokenProvider: TokenProvider;

    constructor(chatUrl: string, userAgent: string, tokenProvider: TokenProvider) {
        this.chatUrl = chatUrl;
        this.userAgent = userAgent;
        this.tokenProvider = tokenProvider;
    }

    async sendPrompt(request: ChatRequest): Promise<ChatResponse> {

        const accessToken = await this.tokenProvider();
        if (!accessToken) {
          throw new Error(`Please login to Pulumi Cloud to use this feature.`);
        }

        const response = await fetch(this.chatUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${accessToken}`,
                'User-Agent': this.userAgent,
            },
            body: JSON.stringify(request)
        });
    
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Pulumi Copilot API is unavailable (${response.statusText}).\n` + text);
        }

        const json = await response.json();
        return json as ChatResponse;
    }
}

export function templateUrl(conversationId: string, program: ProgramContent): string {
  if(program.templateUrl) {
    // e.g. `https://api.pulumi.com/api/orgs/pulumi/ai/conversations/eron-pulumi-corp/2e5289fe-d35e-4593-97b4-989aba35e629/programs/15AMOnD-0.zip`;
    return program.templateUrl;
  }
  // a legacy URL for demo purposes
  return `https://www.pulumi.com/ai/api/project/859bfc82-d039-4b24-ac02-751e3b4e22f6.zip`;
}
