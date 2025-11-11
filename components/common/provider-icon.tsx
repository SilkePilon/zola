"use client"

import { PROVIDERS } from "@/lib/providers"
import { cn } from "@/lib/utils"
import React from "react"

type Props = {
  providerId?: string | null
  logoUrl?: string | null
  className?: string
  title?: string
}

export function ProviderIcon({ providerId, logoUrl, className, title }: Props) {
  const Icon = providerId
    ? PROVIDERS.find((p) => p.id === providerId)?.icon
    : undefined

  const [svg, setSvg] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setSvg(null)
    if (Icon) return

    const candidates: string[] = []
    // Prefer same-origin cached asset first
    if (providerId) candidates.push(`/provider-logos/${providerId}.svg`)
    if (logoUrl) candidates.push(logoUrl)
    if (providerId) {
      candidates.push(`https://models.dev/logos/${providerId}.svg`)
      candidates.push(`https://models.dev/logos/${String(providerId).toLowerCase()}.svg`)
    }

    function transformInlineSvg(raw: string) {
      // Only operate on the opening <svg ...> tag
      const openTagMatch = raw.match(/<svg[^>]*>/i)
      if (!openTagMatch) return raw

      const openTag = openTagMatch[0]
      let transformed = openTag
        // remove width/height on the root svg to allow Tailwind sizing
        .replace(/\swidth="[^"]*"/i, "")
        .replace(/\sheight="[^"]*"/i, "")

      if (/\sclass=/.test(transformed)) {
        // Inject Tailwind classes into existing class attribute
        transformed = transformed.replace(
          /class="([^"]*)"/i,
          (_m, cls) => `class="${cls} block w-full h-full"`
        )
      } else {
        // Add a new class attribute with Tailwind sizing
        transformed = transformed.replace(
          /<svg(\s*)/i,
          (_m, sp) => `<svg${sp}class="block w-full h-full" `
        )
      }

      if (!/preserveAspectRatio=/i.test(transformed)) {
        transformed = transformed.replace(
          /<svg(\s*)/i,
          (_m, sp) => `<svg${sp}preserveAspectRatio="xMidYMid meet" `
        )
      }

      // Replace only the first opening tag occurrence
      return raw.replace(openTag, transformed)
    }

    async function load() {
      for (const url of candidates) {
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const text = await res.text()
          if (cancelled) return
          const isSvg = /<svg[\s\S]*?>[\s\S]*<\/svg>/i.test(text)
          if (isSvg) {
            setSvg(transformInlineSvg(text))
            return
          }
        } catch {
          // try next
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [Icon, logoUrl, providerId])

  if (Icon) {
    return (
      <span
        title={title}
        className={cn("inline-flex items-center justify-center", className)}
      >
        <Icon
          className="themed-icon block"
          aria-hidden
        />
      </span>
    )
  }

  if (svg) {
    return (
      <span
        title={title}
        className={cn("inline-flex items-center justify-center", className)}
      >
        <span
          className="themed-icon inline-flex items-center justify-center"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </span>
    )
  }

  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      aria-hidden
    />
  )
}

export default ProviderIcon
