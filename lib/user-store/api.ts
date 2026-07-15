import { toast } from "@/components/ui/toast"
import { authClient } from "@/lib/auth-client"
import { fetchClient } from "@/lib/fetch"
import type { UserProfile } from "@/lib/user/types"

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const res = await fetchClient("/api/user")
  if (!res.ok) return null
  const { user } = await res.json()
  return user
}

export async function updateUserProfile(
  _id: string,
  updates: Partial<UserProfile>
): Promise<boolean> {
  const res = await fetchClient("/api/user", {
    method: "PUT",
    body: JSON.stringify(updates),
  })
  return res.ok
}

export async function signOutUser(): Promise<boolean> {
  try {
    await authClient.signOut()
    return true
  } catch (error) {
    console.error("Failed to sign out:", error)
    toast({ title: "Failed to sign out", status: "error" })
    return false
  }
}
