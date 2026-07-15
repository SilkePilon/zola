import type { mapChatRow, mapMessageRow } from "@/lib/db/mappers"

export type Chat = ReturnType<typeof mapChatRow>
export type Chats = ReturnType<typeof mapChatRow>
export type Message = ReturnType<typeof mapMessageRow>
