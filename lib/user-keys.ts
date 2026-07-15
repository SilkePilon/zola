import "server-only"
import { db } from "@/lib/db/client"
import { userKeys } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { decryptKey } from "./encryption"

export type Provider = string
export type ProviderWithoutOllama = string

export async function getUserKey(
  userId: string,
  provider: Provider
): Promise<string | null> {
  try {
    const [row] = await db
      .select({ encryptedKey: userKeys.encryptedKey, iv: userKeys.iv })
      .from(userKeys)
      .where(
        and(eq(userKeys.userId, userId), eq(userKeys.provider, provider))
      )
      .limit(1)

    if (!row) return null

    return decryptKey(row.encryptedKey, row.iv)
  } catch (error) {
    console.error("Error retrieving user key:", error)
    return null
  }
}

export async function getEffectiveApiKey(
  userId: string | null,
  provider: ProviderWithoutOllama
): Promise<string | null> {
  if (!userId) return null

  return await getUserKey(userId, provider)
}
