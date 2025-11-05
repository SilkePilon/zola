import fs from "fs/promises"
import path from "path"

const LOGOS_DIR = path.join(process.cwd(), "public", "provider-logos")

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {}
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function fetchSvg(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const text = await res.text()
    const isSvg = /<svg[\s\S]*?>[\s\S]*<\/svg>/i.test(text)
    return isSvg ? text : null
  } catch {
    return null
  }
}

export async function ensureProviderLogosCached(providerIds: string[]) {
  const unique = Array.from(new Set(providerIds.filter(Boolean)))
  await ensureDir(LOGOS_DIR)

  await Promise.all(
    unique.map(async (id) => {
      const target = path.join(LOGOS_DIR, `${id}.svg`)
      if (await fileExists(target)) return

      const candidates = [
        `https://models.dev/logos/${id}.svg`,
        `https://models.dev/logos/${String(id).toLowerCase()}.svg`,
      ]

      for (const url of candidates) {
        const svg = await fetchSvg(url)
        if (svg) {
          try {
            await fs.writeFile(target, svg, "utf8")
            return
          } catch {
            // Continue to next candidate
          }
        }
      }
    })
  )
}
