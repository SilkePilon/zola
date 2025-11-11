import { decryptKey } from "./encryption"
import { createClient } from "./supabase/server"

// Dynamic provider types - can be any string from models.dev API
export type Provider = string
export type ProviderWithoutOllama = string

export async function getUserKey(
  userId: string,
  provider: Provider
): Promise<string | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null

    const { data, error } = await supabase
      .from("user_keys")
      .select("encrypted_key, iv")
      .eq("user_id", userId)
      .eq("provider", provider)
      .single()

    if (error || !data) return null

    return decryptKey(data.encrypted_key, data.iv)
  } catch (error) {
    console.error("Error retrieving user key:", error)
    return null
  }
}

export async function getEffectiveApiKey(
  userId: string | null,
  provider: ProviderWithoutOllama
): Promise<string | null> {
  // Only use user-provided keys from database, no env variable fallback
  if (!userId) return null
  
  const userKey = await getUserKey(userId, provider)
  return userKey
}
