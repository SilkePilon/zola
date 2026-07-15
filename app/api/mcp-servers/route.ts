import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapMcpServerRow } from "@/lib/db/mappers"
import { mcpServers } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ servers: [] })
  }

  const rows = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.userId, session.user.id))
    .orderBy(desc(mcpServers.createdAt))

  return NextResponse.json({ servers: rows.map(mapMcpServerRow) })
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const [row] = await db
    .insert(mcpServers)
    .values({
      userId: session.user.id,
      name: body.name,
      description: body.description || null,
      enabled: body.enabled,
      transportType: body.transportType,
      url: body.url || null,
      headers: body.headers || null,
    })
    .returning()

  return NextResponse.json({ server: mapMcpServerRow(row) })
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await db.delete(mcpServers).where(eq(mcpServers.userId, session.user.id))

  return NextResponse.json({ success: true })
}
