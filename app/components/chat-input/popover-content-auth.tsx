"use client"

import { Button } from "@/components/ui/button"
import { PopoverContent } from "@/components/ui/popover"
import { APP_NAME } from "@/lib/config"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { SocialAuthButtons } from "../auth/social-auth-buttons"
import { useAuthProviders } from "../auth/use-auth-providers"

export function PopoverContentAuth() {
  const { providers } = useAuthProviders()
  const [error, setError] = useState<string | null>(null)

  return (
    <PopoverContent
      className="w-[300px] overflow-hidden rounded-xl p-0"
      side="top"
      align="start"
    >
      <Image
        src="/banner_forest.jpg"
        alt={`calm paint generate by ${APP_NAME}`}
        width={300}
        height={128}
        className="h-32 w-full object-cover"
      />
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}
      <div className="p-3">
        <p className="text-primary mb-1 text-base font-medium">
          Login to try more features for free
        </p>
        <p className="text-muted-foreground mb-5 text-base">
          Add files, use more models, BYOK, and more.
        </p>
        <div className="flex flex-col gap-2">
          <SocialAuthButtons providers={providers} onError={setError} />
          {/* This popover is too narrow for the email/password form, so send
              those users to the full auth page instead. */}
          <Button
            asChild
            variant="secondary"
            size="lg"
            className="w-full text-base"
          >
            <Link href="/auth">Continue with email</Link>
          </Button>
        </div>
      </div>
    </PopoverContent>
  )
}
