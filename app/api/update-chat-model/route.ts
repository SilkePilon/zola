import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { chatId, model } = await request.json()

    if (!chatId || !model) {
      return NextResponse.json(
        { error: "Missing chatId or model" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db
      .update(chats)
      .set({ model, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    console.error("Error in update-chat-model endpoint:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
