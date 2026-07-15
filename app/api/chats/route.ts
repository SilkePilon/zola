import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapChatRow } from "@/lib/db/mappers"
import { chats } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ chats: [] })
  }

  const rows = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, session.user.id))
    .orderBy(
      desc(chats.pinned),
      sql`${chats.pinnedAt} DESC NULLS LAST`,
      desc(chats.updatedAt)
    )

  return NextResponse.json({ chats: rows.map(mapChatRow) })
}
