"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signInWithEmail, signUpWithEmail } from "@/lib/api"
import {
  MIN_PASSWORD_LENGTH,
  hasAnySocialProvider,
  type AuthProviders,
} from "@/lib/auth-shared"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { SocialAuthButtons } from "./social-auth-buttons"

export type AuthMode = "signin" | "signup"

type AuthFormProps = {
  providers: AuthProviders
  /** Where to send the user after a successful sign in/up. Defaults to the current path. */
  redirectPath?: string
  className?: string
}

/**
 * Email/password sign in and sign up, plus whichever social providers this
 * deployment configured. Email/password is always offered, so this renders a
 * usable form even when no social provider is set up.
 */
export function AuthForm({ providers, redirectPath, className }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSignUp = mode === "signup"
  const showSocial = hasAnySocialProvider(providers)

  function switchMode() {
    setMode(isSignUp ? "signin" : "signup")
    setError(null)
    setPassword("")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (isSignUp) {
        await signUpWithEmail(name.trim(), email.trim(), password, redirectPath)
      } else {
        await signInWithEmail(email.trim(), password, redirectPath)
      }
      // On success both helpers navigate away, so the component unmounts and
      // isLoading intentionally stays true to keep the button disabled.
    } catch (err: unknown) {
      setError(
        (err as Error).message ||
          "An unexpected error occurred. Please try again."
      )
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
        >
          {error}
        </div>
      )}

      {showSocial && (
        <>
          <SocialAuthButtons
            providers={providers}
            redirectPath={redirectPath}
            disabled={isLoading}
            onError={setError}
          />
          <div className="flex items-center gap-3">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <div className="bg-border h-px flex-1" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="auth-name">Name</Label>
            <Input
              id="auth-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          {isSignUp && (
            <p className="text-muted-foreground text-xs">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading
            ? isSignUp
              ? "Creating account..."
              : "Signing in..."
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          type="button"
          onClick={switchMode}
          disabled={isLoading}
          className="text-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </button>
      </p>
    </div>
  )
}
