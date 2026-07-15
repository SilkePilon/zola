import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats, modelUsage } from "@/lib/db/schema"
import { count, desc, eq, sum } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const rows = await db
      .select({
        id: modelUsage.id,
        model_id: modelUsage.modelId,
        provider_id: modelUsage.providerId,
        input_tokens: modelUsage.inputTokens,
        output_tokens: modelUsage.outputTokens,
        total_tokens: modelUsage.totalTokens,
        input_cost_usd: modelUsage.inputCostUsd,
        output_cost_usd: modelUsage.outputCostUsd,
        total_cost_usd: modelUsage.totalCostUsd,
        created_at: modelUsage.createdAt,
        chat_id: modelUsage.chatId,
        chats: { title: chats.title },
      })
      .from(modelUsage)
      .leftJoin(chats, eq(modelUsage.chatId, chats.id))
      .where(eq(modelUsage.userId, session.user.id))
      .orderBy(desc(modelUsage.createdAt))
      .limit(limit)
      .offset(offset)

    const usage = rows.map((row) => ({
      ...row,
      chats: row.chat_id ? { title: row.chats?.title ?? null } : null,
      input_cost_usd:
        row.input_cost_usd !== null ? Number(row.input_cost_usd) : null,
      output_cost_usd:
        row.output_cost_usd !== null ? Number(row.output_cost_usd) : null,
      total_cost_usd:
        row.total_cost_usd !== null ? Number(row.total_cost_usd) : null,
      created_at: row.created_at ? row.created_at.toISOString() : null,
    }))

    const [totalRow] = await db
      .select({ value: count() })
      .from(modelUsage)
      .where(eq(modelUsage.userId, session.user.id))

    const [sumRow] = await db
      .select({ value: sum(modelUsage.totalCostUsd) })
      .from(modelUsage)
      .where(eq(modelUsage.userId, session.user.id))

    return NextResponse.json({
      usage,
      total: totalRow?.value ?? 0,
      totalCost: sumRow?.value ? Number(sumRow.value) : 0,
    })
  } catch (err: unknown) {
    console.error("Error in model-usage API:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
