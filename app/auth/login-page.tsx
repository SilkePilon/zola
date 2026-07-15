"use client"

import type { AuthProviders } from "@/lib/auth-shared"
import Link from "next/link"
import { AuthForm } from "../components/auth/auth-form"
import { HeaderGoBack } from "../components/header-go-back"

type LoginPageProps = {
  providers: AuthProviders
}

export default function LoginPage({ providers }: LoginPageProps) {
  return (
    <div className="bg-background flex min-h-dvh w-full flex-col">
      <HeaderGoBack href="/" />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-foreground text-3xl font-medium tracking-tight sm:text-4xl">
              Welcome to Zola
            </h1>
            <p className="text-muted-foreground mt-3">
              Sign in below to increase your message limits.
            </p>
          </div>

          {/* From the login page, always land on home rather than back on /auth. */}
          <AuthForm providers={providers} redirectPath="/" />
        </div>
      </main>

      <footer className="text-muted-foreground py-6 text-center text-sm">
        <p>
          By continuing, you agree to our{" "}
          <Link href="/" className="text-foreground hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/" className="text-foreground hover:underline">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  )
}
