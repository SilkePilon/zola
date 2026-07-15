import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ chatId: string }> }

export async function PUT(request: Request, { params }: Params) {
  const { chatId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title, public: isPublic } = (await request.json()) as {
    title?: string
    public?: boolean
  }

  const updates: Partial<typeof chats.$inferInsert> = { updatedAt: new Date() }
  if (title !== undefined) updates.title = title
  if (isPublic !== undefined) updates.public = isPublic

  const result = await db
    .update(chats)
    .set(updates)
    .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))
    .returning({ id: chats.id, public: chats.public })

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, chat: result[0] })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { chatId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))
    .returning({ id: chats.id })

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
