import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats, messages } from "@/lib/db/schema"
import { and, eq, gte } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ chatId: string; messageId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const { chatId, messageId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [chat] = await db
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (!chat || chat.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [target] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(eq(messages.chatId, chatId), eq(messages.id, Number(messageId)))
    )
    .limit(1)

  if (!target || !target.createdAt) {
    return NextResponse.json({ success: true })
  }

  await db
    .delete(messages)
    .where(
      and(eq(messages.chatId, chatId), gte(messages.createdAt, target.createdAt))
    )

  return NextResponse.json({ success: true })
}
