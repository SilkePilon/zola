import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { userPreferences } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [data] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .limit(1)

    if (!data) {
      return NextResponse.json({
        layout: "fullscreen",
        prompt_suggestions: true,
        show_tool_invocations: true,
        show_conversation_previews: true,
        multi_model_enabled: false,
        hidden_models: [],
      })
    }

    return NextResponse.json({
      layout: data.layout,
      prompt_suggestions: data.promptSuggestions,
      show_tool_invocations: data.showToolInvocations,
      show_conversation_previews: data.showConversationPreviews,
      multi_model_enabled: data.multiModelEnabled,
      hidden_models: data.hiddenModels || [],
    })
  } catch (error) {
    console.error("Error in user-preferences GET API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      layout,
      prompt_suggestions,
      show_tool_invocations,
      show_conversation_previews,
      multi_model_enabled,
      hidden_models,
    } = body

    if (layout && typeof layout !== "string") {
      return NextResponse.json(
        { error: "layout must be a string" },
        { status: 400 }
      )
    }

    if (hidden_models && !Array.isArray(hidden_models)) {
      return NextResponse.json(
        { error: "hidden_models must be an array" },
        { status: 400 }
      )
    }

    const updateData: {
      layout?: string
      promptSuggestions?: boolean
      showToolInvocations?: boolean
      showConversationPreviews?: boolean
      multiModelEnabled?: boolean
      hiddenModels?: string[]
    } = {}
    if (layout !== undefined) updateData.layout = layout
    if (prompt_suggestions !== undefined)
      updateData.promptSuggestions = prompt_suggestions
    if (show_tool_invocations !== undefined)
      updateData.showToolInvocations = show_tool_invocations
    if (show_conversation_previews !== undefined)
      updateData.showConversationPreviews = show_conversation_previews
    if (multi_model_enabled !== undefined)
      updateData.multiModelEnabled = multi_model_enabled
    if (hidden_models !== undefined) updateData.hiddenModels = hidden_models

    const [data] = await db
      .insert(userPreferences)
      .values({ userId: session.user.id, ...updateData })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...updateData, updatedAt: new Date() },
      })
      .returning()

    return NextResponse.json({
      success: true,
      layout: data.layout,
      prompt_suggestions: data.promptSuggestions,
      show_tool_invocations: data.showToolInvocations,
      show_conversation_previews: data.showConversationPreviews,
      multi_model_enabled: data.multiModelEnabled,
      hidden_models: data.hiddenModels || [],
    })
  } catch (error) {
    console.error("Error in user-preferences PUT API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
