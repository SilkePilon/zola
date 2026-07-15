import { db } from "@/lib/db/client"
import { mapChatRow } from "@/lib/db/mappers"
import { chats } from "@/lib/db/schema"
import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel } from "@/lib/usage"

type CreateChatInput = {
  userId: string
  title?: string
  model: string
  isAuthenticated: boolean
  projectId?: string
}

export async function createChatInDb({
  userId,
  title,
  model,
  isAuthenticated,
  projectId,
}: CreateChatInput) {
  await validateUserIdentity(userId, isAuthenticated)
  await checkUsageByModel(userId, model, isAuthenticated)

  const [row] = await db
    .insert(chats)
    .values({
      userId,
      title: title || "New Chat",
      model,
      projectId: projectId ?? null,
    })
    .returning()

  return row ? mapChatRow(row) : null
}
