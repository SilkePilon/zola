import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { chatId, pinned } = await request.json()

    if (!chatId || typeof pinned !== "boolean") {
      return NextResponse.json(
        { error: "Missing chatId or pinned" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const toggle = pinned
      ? { pinned: true, pinnedAt: new Date() }
      : { pinned: false, pinnedAt: null }

    await db
      .update(chats)
      .set({ ...toggle, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("toggle-chat-pin unhandled error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
