"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signOut() {
  await auth.api.signOut({ headers: await headers() })
  revalidatePath("/", "layout")
  redirect("/auth/login")
}
