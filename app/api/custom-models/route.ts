import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapCustomModelRow } from "@/lib/db/mappers"
import { customModels } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await db
    .select()
    .from(customModels)
    .where(eq(customModels.userId, session.user.id))
    .orderBy(desc(customModels.createdAt))

  return NextResponse.json({ customModels: data.map(mapCustomModelRow) })
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    name,
    modelId,
    providerId,
    baseUrl,
    contextWindow,
    inputCost,
    outputCost,
    vision,
    tools,
    reasoning,
    audio,
    video,
  } = body

  if (!name || !modelId || !providerId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    )
  }

  try {
    const [data] = await db
      .insert(customModels)
      .values({
        userId: session.user.id,
        name,
        modelId,
        providerId,
        baseUrl,
        contextWindow,
        inputCost: inputCost !== undefined ? String(inputCost) : undefined,
        outputCost: outputCost !== undefined ? String(outputCost) : undefined,
        vision: vision || false,
        tools: tools || false,
        reasoning: reasoning || false,
        audio: audio || false,
        video: video || false,
      })
      .returning()

    return NextResponse.json({ customModel: mapCustomModelRow(data) })
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "A custom model with this ID already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing model ID" }, { status: 400 })
  }

  const body = await request.json()
  const {
    name,
    modelId,
    providerId,
    baseUrl,
    contextWindow,
    inputCost,
    outputCost,
    vision,
    tools,
    reasoning,
    audio,
    video,
  } = body

  if (!name || !modelId || !providerId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    )
  }

  const [data] = await db
    .update(customModels)
    .set({
      name,
      modelId,
      providerId,
      baseUrl,
      contextWindow,
      inputCost: inputCost !== undefined ? String(inputCost) : undefined,
      outputCost: outputCost !== undefined ? String(outputCost) : undefined,
      vision: vision || false,
      tools: tools || false,
      reasoning: reasoning || false,
      audio: audio || false,
      video: video || false,
      updatedAt: new Date(),
    })
    .where(
      and(eq(customModels.id, id), eq(customModels.userId, session.user.id))
    )
    .returning()

  if (!data) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 })
  }

  return NextResponse.json({ customModel: mapCustomModelRow(data) })
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing model ID" }, { status: 400 })
  }

  await db
    .delete(customModels)
    .where(
      and(eq(customModels.id, id), eq(customModels.userId, session.user.id))
    )

  return NextResponse.json({ success: true })
}
