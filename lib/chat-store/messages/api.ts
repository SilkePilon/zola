import type { UIMessage as MessageAISDK } from "ai"
import { fetchClient } from "../../fetch"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

type ChatMessage = MessageAISDK & {
  content?: string
  createdAt?: Date
  message_group_id?: string | null
  model?: string | null
}

type MessageRow = {
  id: string
  content: string | null
  role: string
  created_at: string | null
  parts: unknown
  message_group_id: string | null
  model: string | null
}

export async function getMessagesFromDb(
  chatId: string
): Promise<ChatMessage[]> {
  const res = await fetchClient(`/api/chats/${chatId}/messages`)
  if (!res.ok) {
    return await getCachedMessages(chatId)
  }

  const { messages } = (await res.json()) as { messages: MessageRow[] }

  return messages.map((message) => ({
    id: message.id,
    role: message.role as ChatMessage["role"],
    content: message.content ?? "",
    parts: message.parts as ChatMessage["parts"],
    createdAt: new Date(message.created_at || ""),
    message_group_id: message.message_group_id,
    model: message.model,
  }))
}

async function postMessagesToDb(chatId: string, messages: ChatMessage[]) {
  await fetchClient(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messages: messages.map((message) => ({
        role: message.role,
        content: (message as { content?: string }).content,
        parts: message.parts,
        created_at:
          message.createdAt?.toISOString() || new Date().toISOString(),
        message_group_id: message.message_group_id || null,
        model: message.model || null,
      })),
    }),
  })
}

async function deleteMessagesFromDb(chatId: string) {
  const res = await fetchClient(`/api/chats/${chatId}/messages`, {
    method: "DELETE",
  })
  if (!res.ok) {
    console.error("Failed to clear messages from database:", await res.text())
  }
}

async function deleteMessagesFromId(chatId: string, messageId: string) {
  const res = await fetchClient(
    `/api/chats/${chatId}/messages/from/${messageId}`,
    { method: "DELETE" }
  )
  if (!res.ok) {
    console.error("Failed to delete messages:", await res.text())
  }
}

type ChatMessageEntry = {
  id: string
  messages: ChatMessage[]
}

export async function getCachedMessages(
  chatId: string
): Promise<ChatMessage[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messages: ChatMessage[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function addMessage(
  chatId: string,
  message: ChatMessage
): Promise<void> {
  await postMessagesToDb(chatId, [message])
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: ChatMessage[]
): Promise<void> {
  await postMessagesToDb(chatId, messages)
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}

export async function deleteMessagesFromIdForChat(
  chatId: string,
  messageId: string,
  remainingMessages: ChatMessage[]
): Promise<void> {
  await deleteMessagesFromId(chatId, messageId)
  await writeToIndexedDB("messages", {
    id: chatId,
    messages: remainingMessages,
  })
}
