import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET: Fetch user's custom models
export async function GET() {
  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await (supabase as any)
    .from("custom_models")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ customModels: data })
}

// POST: Create a new custom model
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
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

  const { data, error } = await (supabase as any)
    .from("custom_models")
    .insert({
      user_id: user.id,
      name,
      model_id: modelId,
      provider_id: providerId,
      base_url: baseUrl,
      context_window: contextWindow,
      input_cost: inputCost,
      output_cost: outputCost,
      vision: vision || false,
      tools: tools || false,
      reasoning: reasoning || false,
      audio: audio || false,
      video: video || false,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A custom model with this ID already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ customModel: data })
}

// PUT: Update an existing custom model
export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
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

  const { data, error } = await (supabase as any)
    .from("custom_models")
    .update({
      name,
      model_id: modelId,
      provider_id: providerId,
      base_url: baseUrl,
      context_window: contextWindow,
      input_cost: inputCost,
      output_cost: outputCost,
      vision: vision || false,
      tools: tools || false,
      reasoning: reasoning || false,
      audio: audio || false,
      video: video || false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 })
  }

  return NextResponse.json({ customModel: data })
}

// DELETE: Remove a custom model
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing model ID" }, { status: 400 })
  }

  const { error } = await (supabase as any)
    .from("custom_models")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
