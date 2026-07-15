import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapMessageRow } from "@/lib/db/mappers"
import { chats, messages } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ chatId: string }> }

type IncomingMessage = {
  role: "system" | "user" | "assistant" | "data"
  content?: string
  parts?: unknown
  created_at?: string
  message_group_id?: string | null
  model?: string | null
}

async function assertChatOwnership(chatId: string, userId: string) {
  const [chat] = await db
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  return Boolean(chat && chat.userId === userId)
}

export async function GET(_request: Request, { params }: Params) {
  const { chatId } = await params

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))

  return NextResponse.json({ messages: rows.map(mapMessageRow) })
}

export async function POST(request: Request, { params }: Params) {
  const { chatId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await assertChatOwnership(chatId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { messages: incoming } = (await request.json()) as {
    messages: IncomingMessage[]
  }

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json(
      { error: "No messages provided" },
      { status: 400 }
    )
  }

  await db.insert(messages).values(
    incoming.map((message) => ({
      chatId,
      role: message.role,
      content: message.content,
      parts: message.parts,
      createdAt: message.created_at
        ? new Date(message.created_at)
        : new Date(),
      messageGroupId: message.message_group_id ?? null,
      model: message.model ?? null,
    }))
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { chatId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await assertChatOwnership(chatId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.delete(messages).where(eq(messages.chatId, chatId))

  return NextResponse.json({ success: true })
}
