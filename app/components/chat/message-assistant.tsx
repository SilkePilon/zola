import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/prompt-kit/message"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import { ArrowClockwise, Check, Copy } from "@phosphor-icons/react"
import { useCallback, useRef } from "react"
import { getSources } from "./get-sources"
import { QuoteButton } from "./quote-button"
import { Reasoning } from "./reasoning"
import { SearchImages } from "./search-images"
import { SourcesList } from "./sources-list"
import { ToolInvocation } from "./tool-invocation"
import { useAssistantMessageSelection } from "./useAssistantMessageSelection"
import Image from "next/image"
import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogImage,
  MorphingDialogTrigger,
} from "@/components/motion-primitives/morphing-dialog"

type MessageAssistantProps = {
  children: string
  isLast?: boolean
  hasScrollAnchor?: boolean
  copied?: boolean
  copyToClipboard?: () => void
  onReload?: () => void
  parts?: UIMessage["parts"]
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  messageId: string
  onQuote?: (text: string, messageId: string) => void
}

export function MessageAssistant({
  children,
  isLast,
  hasScrollAnchor,
  copied,
  copyToClipboard,
  onReload,
  parts,
  status,
  className,
  messageId,
  onQuote,
}: MessageAssistantProps) {
  const { preferences } = useUserPreferences()
  const sources = getSources(parts)
  const toolInvocationParts = parts?.filter(
    (part) => typeof part.type === "string" && part.type.startsWith("tool-")
  ) as any[] | undefined
  // Collect reasoning parts (support multiple chunks)
  const reasoningParts = (parts?.filter((part) => part.type === "reasoning") || []) as any[]
  const reasoningText: string | undefined = (() => {
    if (!reasoningParts || reasoningParts.length === 0) return undefined
    const collectText = (p: any): string | undefined => {
      if (typeof p?.text === "string" && p.text.length > 0) return p.text
      if (typeof p?.reasoning === "string" && p.reasoning.length > 0)
        return p.reasoning
      const details = p?.details
      if (Array.isArray(details)) {
        const textDetails = details
          .map((d: any) => (typeof d?.text === "string" ? d.text : undefined))
          .filter((t: any): t is string => !!t)
        if (textDetails.length > 0) return textDetails.join("\n")
      }
      return undefined
    }
    const texts = reasoningParts
      .map(collectText)
      .filter((t): t is string => typeof t === "string" && t.length > 0)
    if (texts.length === 0) return undefined
    // Join multiple chunks with newlines to reflect streaming accumulation
    return texts.join("\n")
  })()
  const contentNullOrEmpty = children === null || children === ""
  const isLastStreaming = status === "streaming" && isLast
  const searchImageResults =
    parts
      ?.filter((part) => {
        if (typeof part.type !== "string") return false
        if (!part.type.startsWith("tool-")) return false
        const name = part.type.slice(5)
        const state = (part as any).state
        return name === "imageSearch" && state === "output-available"
      })
      .flatMap((part) => {
        const output: any = (part as any).output
        if (!output) return []
        // Prefer v5 structured results
        if (Array.isArray(output.results)) return output.results
        // Fallback for v4-style content wrapper
        const content0 = output?.content?.[0]
        if (content0?.type === "images") return content0.results ?? []
        return []
      }) ?? []

  // Assistant-generated image/file parts (e.g. inline image outputs)
  type ImagePart = { mimeType: string; data: string }
  const assistantImageParts: ImagePart[] = []
  
  for (const p of parts || []) {
    if (
      typeof p === 'object' && p !== null && 
      'type' in p && (p as { type?: string }).type === "file" && 
      'mimeType' in p && typeof (p as { mimeType?: string }).mimeType === "string" &&
      (p as { mimeType?: string }).mimeType?.startsWith("image") &&
      'data' in p && typeof (p as { data?: string }).data === "string"
    ) {
      assistantImageParts.push({
        mimeType: (p as { mimeType: string }).mimeType,
        data: (p as { data: string }).data
      })
    }
  }

  const isQuoteEnabled = !preferences.multiModelEnabled
  const messageRef = useRef<HTMLDivElement>(null)
  const { selectionInfo, clearSelection } = useAssistantMessageSelection(
    messageRef,
    isQuoteEnabled
  )
  const handleQuoteBtnClick = useCallback(() => {
    if (selectionInfo && onQuote) {
      onQuote(selectionInfo.text, selectionInfo.messageId)
      clearSelection()
    }
  }, [selectionInfo, onQuote, clearSelection])

  return (
    <Message
      className={cn(
        "group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2",
        hasScrollAnchor && "min-h-scroll-anchor",
        className
      )}
    >
      <div
        ref={messageRef}
        className={cn(
          "relative flex min-w-full flex-col gap-2",
          isLast && "pb-8"
        )}
        {...(isQuoteEnabled && { "data-message-id": messageId })}
      >
        {assistantImageParts?.length > 0 && (
          <div className="flex flex-row flex-wrap gap-2">
            {assistantImageParts.map((attachment, index) => (
              <MorphingDialog
                key={`${attachment.mimeType}-${index}`}
                transition={{ type: "spring", stiffness: 280, damping: 18, mass: 0.3 }}
              >
                <MorphingDialogTrigger className="z-10">
                  <Image
                    className="mb-1 w-40 rounded-md"
                    src={`data:${attachment.mimeType};base64,${attachment.data}`}
                    alt={"Generated image"}
                    width={160}
                    height={120}
                  />
                </MorphingDialogTrigger>
                <MorphingDialogContainer>
                  <MorphingDialogContent className="relative rounded-lg">
                    <MorphingDialogImage
                      src={`data:${attachment.mimeType};base64,${attachment.data}`}
                      alt={""}
                      className="max-h-[90vh] max-w-[90vw] object-contain"
                    />
                  </MorphingDialogContent>
                  <MorphingDialogClose className="text-primary" />
                </MorphingDialogContainer>
              </MorphingDialog>
            ))}
          </div>
        )}
        {reasoningText && (
          <Reasoning
            reasoningText={reasoningText}
            isStreaming={status === "streaming"}
          />
        )}

        {toolInvocationParts &&
          toolInvocationParts.length > 0 &&
          preferences.showToolInvocations && (
            <ToolInvocation toolInvocations={toolInvocationParts as any[]} />
          )}

        {searchImageResults.length > 0 && (
          <SearchImages results={searchImageResults} />
        )}

        {contentNullOrEmpty ? null : (
          <MessageContent
            className={cn(
              "prose dark:prose-invert relative min-w-full bg-transparent p-0",
              "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
            )}
            markdown={true}
          >
            {children}
          </MessageContent>
        )}

        {sources && sources.length > 0 && <SourcesList sources={sources} />}

        {Boolean(isLastStreaming || contentNullOrEmpty) ? null : (
          <MessageActions
            className={cn(
              "-ml-2 flex gap-0 opacity-0 transition-opacity group-hover:opacity-100"
            )}
          >
            <MessageAction
              tooltip={copied ? "Copied!" : "Copy text"}
              side="bottom"
            >
              <button
                className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
                aria-label="Copy text"
                onClick={copyToClipboard}
                type="button"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </MessageAction>
            {isLast ? (
              <MessageAction
                tooltip="Regenerate"
                side="bottom"
                delayDuration={0}
              >
                <button
                  className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
                  aria-label="Regenerate"
                  onClick={onReload}
                  type="button"
                >
                  <ArrowClockwise className="size-4" />
                </button>
              </MessageAction>
            ) : null}
          </MessageActions>
        )}

        {isQuoteEnabled && selectionInfo && selectionInfo.messageId && (
          <QuoteButton
            mousePosition={selectionInfo.position}
            onQuote={handleQuoteBtnClick}
            messageContainerRef={messageRef}
            onDismiss={clearSelection}
          />
        )}
      </div>
    </Message>
  );
}
