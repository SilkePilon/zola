import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import type { UIMessage as MessageAISDK } from "ai"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

type ChatMessage = MessageAISDK & {
  content?: string
  createdAt?: Date
  message_group_id?: string | null
  model?: string | null
}

export async function getMessagesFromDb(
  chatId: string
): Promise<ChatMessage[]> {
  // fallback to local cache only
  if (!isSupabaseEnabled) {
    const cached = await getCachedMessages(chatId)
    return cached
  }

  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, content, role, created_at, parts, message_group_id, model"
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  if (!data || error) {
    console.error("Failed to fetch messages:", error)
    return []
  }

  return data.map((message) => ({
    id: String(message.id),
    role: message.role as ChatMessage["role"],
    // Keep legacy content for fallbacks in UI during migration
    content: (message as any).content ?? "",
    // Prefer parts (v5); ensure correct typing
    parts: (message as any)?.parts as ChatMessage["parts"],
    // Extra fields we persist alongside
    createdAt: new Date(message.created_at || ""),
    message_group_id: (message as any).message_group_id ?? null,
    model: (message as any).model ?? null,
  }))
}

async function insertMessageToDb(chatId: string, message: ChatMessage) {
  const supabase = createClient()
  if (!supabase) return

  await supabase.from("messages").insert({
    chat_id: chatId,
    role: message.role,
    // Store both legacy content and new parts during transition
    content: (message as any).content,
    parts: message.parts as any,
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: (message as any).message_group_id || null,
    model: (message as any).model || null,
  })
}

async function insertMessagesToDb(chatId: string, messages: ChatMessage[]) {
  const supabase = createClient()
  if (!supabase) return

  const payload = messages.map((message) => ({
    chat_id: chatId,
    role: message.role,
    content: (message as any).content,
    parts: message.parts as any,
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: (message as any).message_group_id || null,
    model: (message as any).model || null,
  }))

  await supabase.from("messages").insert(payload)
}

async function deleteMessagesFromDb(chatId: string) {
  const supabase = createClient()
  if (!supabase) return

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId)

  if (error) {
    console.error("Failed to clear messages from database:", error)
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
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: ChatMessage[]
): Promise<void> {
  await insertMessagesToDb(chatId, messages)
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}
