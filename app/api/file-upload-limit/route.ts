import { auth } from "@/lib/auth"
import { DAILY_FILE_UPLOAD_LIMIT } from "@/lib/config"
import { db } from "@/lib/db/client"
import { chatAttachments } from "@/lib/db/schema"
import { and, count, eq, gte } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  const [{ value: uploadedToday }] = await db
    .select({ value: count() })
    .from(chatAttachments)
    .where(
      and(
        eq(chatAttachments.userId, session.user.id),
        gte(chatAttachments.createdAt, startOfToday)
      )
    )

  if (uploadedToday >= DAILY_FILE_UPLOAD_LIMIT) {
    return NextResponse.json(
      {
        error: "Daily file upload limit reached.",
        code: "DAILY_FILE_LIMIT_REACHED",
      },
      { status: 403 }
    )
  }

  return NextResponse.json({ count: uploadedToday })
}
