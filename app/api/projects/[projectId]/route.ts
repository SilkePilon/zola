import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapProjectRow } from "@/lib/db/mappers"
import { projects } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [data] = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, session.user.id))
      )
      .limit(1)

    if (!data) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(mapProjectRow(data))
  } catch (err: unknown) {
    console.error("Error in project endpoint:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [data] = await db
      .update(projects)
      .set({ name: name.trim() })
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, session.user.id))
      )
      .returning()

    if (!data) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(mapProjectRow(data))
  } catch (err: unknown) {
    console.error("Error updating project:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await db
      .delete(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, session.user.id))
      )
      .returning({ id: projects.id })

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("Error deleting project:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
