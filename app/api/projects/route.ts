import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapProjectRow } from "@/lib/db/mappers"
import { projects } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name } = await request.json()

    const [data] = await db
      .insert(projects)
      .values({ name, userId: session.user.id })
      .returning()

    return NextResponse.json(mapProjectRow(data))
  } catch (err: unknown) {
    console.error("Error in projects endpoint:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, session.user.id))
    .orderBy(asc(projects.createdAt))

  return NextResponse.json(data.map(mapProjectRow))
}
