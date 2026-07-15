"use client"

import { Button } from "@/components/ui/button"
import { signInWithSocial } from "@/lib/api"
import type { AuthProviders, SocialProvider } from "@/lib/auth-shared"
import { GithubLogoIcon } from "@phosphor-icons/react"
import { useState } from "react"

type SocialAuthButtonsProps = {
  providers: AuthProviders
  /** Where to send the user after a successful sign in. Defaults to the current path. */
  redirectPath?: string
  disabled?: boolean
  onError?: (message: string | null) => void
}

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  github: "GitHub",
}

/**
 * Renders a sign-in button per configured social provider. Renders nothing when
 * the deployment has no social providers set up.
 */
export function SocialAuthButtons({
  providers,
  redirectPath,
  disabled,
  onError,
}: SocialAuthButtonsProps) {
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(
    null
  )

  const enabled = (Object.keys(PROVIDER_LABELS) as SocialProvider[]).filter(
    (provider) => providers[provider]
  )

  if (enabled.length === 0) return null

  async function handleSignIn(provider: SocialProvider) {
    try {
      setPendingProvider(provider)
      onError?.(null)
      await signInWithSocial(provider, redirectPath)
      // On success the browser navigates to the provider, so pendingProvider is
      // intentionally left set to keep the button disabled until then.
    } catch (err: unknown) {
      onError?.(
        (err as Error).message ||
          "An unexpected error occurred. Please try again."
      )
      setPendingProvider(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {enabled.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="secondary"
          size="lg"
          className="w-full text-base"
          onClick={() => handleSignIn(provider)}
          disabled={disabled || pendingProvider !== null}
        >
          {provider === "google" ? (
            <img
              src="https://www.google.com/favicon.ico"
              alt=""
              width={20}
              height={20}
              className="mr-2 size-4"
            />
          ) : (
            <GithubLogoIcon className="mr-2 size-4" weight="fill" />
          )}
          <span>
            {pendingProvider === provider
              ? "Connecting..."
              : `Continue with ${PROVIDER_LABELS[provider]}`}
          </span>
        </Button>
      ))}
    </div>
  )
}
