import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mcpServers } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const updates = await request.json()
  const values: {
    name?: string
    description?: string | null
    enabled?: boolean
    transportType?: string
    url?: string | null
    headers?: unknown
    updatedAt: Date
  } = { updatedAt: new Date() }
  if (updates.name !== undefined) values.name = updates.name
  if (updates.description !== undefined)
    values.description = updates.description || null
  if (updates.enabled !== undefined) values.enabled = updates.enabled
  if (updates.transportType !== undefined)
    values.transportType = updates.transportType
  if (updates.url !== undefined) values.url = updates.url || null
  if (updates.headers !== undefined) values.headers = updates.headers || null

  const result = await db
    .update(mcpServers)
    .set(values)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, session.user.id)))
    .returning({ id: mcpServers.id })

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await db
    .delete(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, session.user.id)))

  return NextResponse.json({ success: true })
}
