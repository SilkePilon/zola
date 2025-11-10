import type { UIMessage } from "ai"

export function getSources(parts?: UIMessage["parts"]) {
  const sources = parts
    ?.filter((part) => {
      if (
        part.type === "source-url" ||
        part.type === "source-document"
      )
        return true
      return typeof part.type === "string" && part.type.startsWith("tool-")
    })
    .map((part) => {
      if (part.type === "source-url" || part.type === "source-document") {
        return (part as any).source
      }

      // v5 tool parts: type is `tool-<name>` and results live in `output`
      if (typeof part.type === "string" && part.type.startsWith("tool-")) {
        const toolName = part.type.slice(5)
        const output: any = (part as any).output
        if (toolName === "summarizeSources" && Array.isArray(output?.result)) {
          return output.result.flatMap((item: { citations?: unknown[] }) => item.citations || [])
        }
        if (Array.isArray(output)) return output.flat()
        return output
      }

      return null
    })
    .filter(Boolean)
    .flat()

  const validSources =
    sources?.filter(
      (source) =>
        source && typeof source === "object" && source.url && source.url !== ""
    ) || []

  return validSources
}
