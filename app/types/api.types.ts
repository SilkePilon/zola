export interface ContentPart {
  type: string
  text?: string
  toolCallId?: string
  toolName?: string
  args?: unknown
  result?: unknown
  toolInvocation?: {
    state: string
    step: number
    toolCallId: string
    toolName: string
    args?: unknown
    result?: unknown
  }
  reasoningText?: string
  details?: unknown[]
}

export interface Message {
  role: "user" | "assistant" | "system" | "data" | "tool" | "tool-call"
  content: string | null | ContentPart[]
  reasoningText?: string
}

export interface ChatApiParams {
  userId: string
  model: string
  isAuthenticated: boolean
}

export interface LogUserMessageParams {
  userId: string
  chatId: string
  parts: ContentPart[]
  model: string
  isAuthenticated: boolean
  message_group_id?: string
}

export interface StoreAssistantMessageParams {
  chatId: string
  messages: Message[]
  message_group_id?: string
  model?: string
}

export interface ApiErrorResponse {
  error: string
  details?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse
