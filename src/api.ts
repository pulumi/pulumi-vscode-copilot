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

import axios from "axios";
import * as AxiosLogger from "axios-logger";

/// User API

export interface User {
  id: string;
  name: string;
  email: string;
  githubLogin: string;
  avatarUrl: string;
  hasMFA: boolean;
  organizations: OrganizationSummary[];
}

export interface OrganizationSummary {
  githubLogin: string;
  name: string;
  avatarUrl: string;
}

/// Chat API

export interface ChatRequest {
  conversationId?: string;
  query: string;
  state: ChatRequestState;
}

export interface ChatRequestState {
  client: {
    cloudContext: {
      orgId: string;
      url?: string;
    };
  };
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

export type Message =
  | TraceMessage
  | ResponseMessage
  | StatusMessage
  | ProgramMessage;

export interface ChatResponse {
  conversationId: string;
  messages: Message[];
}

/// API Client

export type TokenProvider = () => Promise<AuthenticationToken | undefined>;

export interface AuthenticationToken {
  readonly accessToken: string;
}

export interface AuthenticationTokenInvalidateOptions {
  /**
   * An optional message that will be displayed to the user when we ask to re-authenticate. Providing additional context
   * as to why you are asking a user to re-authenticate can help increase the odds that they will accept.
   */
  detail?: string;
}

export interface AuthenticationTokenProvider {
  request(): Promise<AuthenticationToken | undefined>;
  invalidate(opts?: AuthenticationTokenInvalidateOptions): void;
}

export class Client {
  private readonly userAgent: string;
  private readonly tokenProvider: AuthenticationTokenProvider;
  private readonly instance: axios.AxiosInstance;

  constructor(
    baseUrl: string,
    userAgent: string,
    tokenProvider: AuthenticationTokenProvider
  ) {
    this.userAgent = userAgent;
    this.tokenProvider = tokenProvider;

    this.instance = axios.create({
      baseURL: baseUrl,
      headers: {
        "User-Agent": this.userAgent,
        "X-Pulumi-Source": "vscode",
      },
    });

    // install interceptors to handle credentials and to log requests and responses
    this.instance.interceptors.request.use(
      async (config) => {
        const accessToken = await this.tokenProvider.request();
        if (!accessToken) {
          throw new Error(`Please login to Pulumi Cloud to use this feature.`);
        }
        config.headers.Authorization = `token ${accessToken.accessToken}`;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    this.instance.interceptors.request.use(
      AxiosLogger.requestLogger,
      AxiosLogger.errorLogger
    );
    this.instance.interceptors.response.use(
      AxiosLogger.responseLogger,
      AxiosLogger.errorLogger
    );
    this.instance.interceptors.response.use(
      async (config) => {
        if (config.status === 401) {
          this.tokenProvider.invalidate({
            detail:
              "Your Pulumi access token was rejected. Please re-authenticate.",
          });
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  async getUserInfo(
    opts?: {
      signal?: axios.GenericAbortSignal
    }
  ): Promise<User> {
    try {
      const response = await this.instance.get<User>("/api/user", {
        signal: opts?.signal,
      });
      return response.data;
    } catch (err) {
      if (!axios.isAxiosError(err)) {
        throw err;
      }
      throw new Error(`Pulumi REST API is unavailable: ${err}.`);
    }
  }

  async sendPrompt(
    request: ChatRequest,
    opts?: {
      signal?: axios.GenericAbortSignal
    }
  ): Promise<ChatResponse> {
    try {
      const response = await this.instance.post<ChatResponse>(
        "/api/ai/chat/preview",
        request,
        {
          signal: opts?.signal,
        }
      );
      return response.data;
    } catch (err) {
      if (!axios.isAxiosError(err)) {
        throw err;
      }
      throw new Error(`Pulumi REST API is unavailable: ${err}.`);
    }
  }
}

export function templateUrl(
  conversationId: string,
  program: ProgramContent
): string {
  if (program.templateUrl) {
    // e.g. `https://api.pulumi.com/api/orgs/pulumi/ai/conversations/eron-pulumi-corp/2e5289fe-d35e-4593-97b4-989aba35e629/programs/15AMOnD-0.zip`;
    return program.templateUrl;
  }
  // a legacy URL for demo purposes
  return `https://www.pulumi.com/ai/api/project/859bfc82-d039-4b24-ac02-751e3b4e22f6.zip`;
}
