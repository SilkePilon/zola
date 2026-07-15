import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { feedback } from "@/lib/db/schema"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { message } = await request.json()
  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    )
  }

  await db.insert(feedback).values({
    userId: session.user.id,
    message,
  })

  return NextResponse.json({ success: true })
}
