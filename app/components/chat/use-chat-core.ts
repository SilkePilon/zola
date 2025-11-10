import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import type { UserProfile } from "@/lib/user/types"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type UseChatCoreProps = {
  initialMessages: any[]
  draftValue: string
  cacheAndAddMessage: (message: any) => void
  chatId: string | null
  user: UserProfile | null
  files: File[]
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>
  setFiles: (files: File[]) => void
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void
  ensureChatExists: (uid: string, input: string) => Promise<string | null>
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>
  selectedModel: string
  clearDraft: () => void
  bumpChat: (chatId: string) => void
}

export function useChatCore({
  initialMessages,
  draftValue,
  cacheAndAddMessage,
  chatId,
  user,
  files,
  createOptimisticAttachments,
  setFiles,
  checkLimitsAndNotify,
  cleanupOptimisticAttachments,
  ensureChatExists,
  handleFileUploads,
  selectedModel,
  clearDraft,
  bumpChat,
}: UseChatCoreProps) {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [enableSearch, setEnableSearch] = useState(false)
  const [usageData, setUsageData] = useState<{
    inputTokens: number
    outputTokens: number
    totalTokens: number
  } | undefined>(undefined)

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(chatId)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // Search params handling
  const searchParams = useSearchParams()
  const prompt = searchParams.get("prompt")

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    console.error("Chat error:", error)
    console.error("Error message:", error.message)
    let errorMsg = error.message || "Something went wrong."

    if (errorMsg === "An error occurred" || errorMsg === "fetch failed") {
      errorMsg = "Something went wrong. Please try again."
    }

    toast({
      title: errorMsg,
      status: "error",
    })
  }, [])

  const [input, setInput] = useState('')

  // Initialize useChat
  const {
    messages,
    status,
    error,
    regenerate,
    stop,
    setMessages,
    sendMessage,
  } = useChat({
    messages: initialMessages as any[],
    onFinish: ({ message }) => {
      cacheAndAddMessage(message as any)
      // Extract usage data from message metadata
      const metadata = (message as any).metadata
      if (metadata?.totalUsage) {
        setUsageData({
          inputTokens: metadata.totalUsage.inputTokens || 0,
          outputTokens: metadata.totalUsage.outputTokens || 0,
          totalTokens: metadata.totalUsage.totalTokens || 0,
        })
      }
    },
    onError: handleError,
    transport: new DefaultChatTransport({ api: API_ROUTE_CHAT })
  })

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => setInput(prompt))
    }
  }, [prompt])

  // Sync messages from initialMessages when they're loaded (e.g., after page reload)
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages as any[])
    }
  }, [initialMessages, messages.length, setMessages])

  // Reset messages when navigating from a chat to home (run outside render)
  useEffect(() => {
    if (prevChatIdRef.current !== null && chatId === null && messages.length > 0) {
      setMessages([])
    }
    prevChatIdRef.current = chatId
    // We intentionally depend on chatId and messages.length to avoid updates during render
  }, [chatId, messages.length, setMessages])

  // Submit action
  const submit = useCallback(async () => {
    setIsSubmitting(true)

    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      setIsSubmitting(false)
      return
    }

    const submittedFiles = [...files]
    setFiles([])

    try {
      const allowed = await checkLimitsAndNotify(uid)
      if (!allowed) {
        return
      }

      const currentChatId = await ensureChatExists(uid, input)
      if (!currentChatId) {
        return
      }

      if (input.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        return
      }

      let attachments: Attachment[] | null = []
      if (submittedFiles.length > 0) {
        attachments = await handleFileUploads(uid, currentChatId)
        if (attachments === null) {
          return
        }
      }

      // Build v5 parts: text + inline file parts (base64)
      const parts: any[] = [{ type: "text", text: input }]
      if (attachments && attachments.length > 0) {
        // fetch each attachment URL and convert to base64 inline data
        const toBase64 = async (url: string) => {
          const res = await fetch(url)
          const blob = await res.blob()
          const arrayBuffer = await blob.arrayBuffer()
          // Convert to base64
          let binary = ''
          const bytes = new Uint8Array(arrayBuffer)
          const chunkSize = 0x8000
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize)
            binary += String.fromCharCode.apply(null, Array.from(chunk) as any)
          }
          return btoa(binary)
        }

        for (const att of attachments) {
          try {
            const data = await toBase64(att.url)
            parts.push({ type: "file", data, mimeType: att.contentType })
          } catch (e) {
            console.warn("Failed to inline attachment, skipping:", att.url, e)
          }
        }
      }

      const options = {
        body: {
          chatId: currentChatId,
          userId: uid,
          model: selectedModel,
          isAuthenticated,
          systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
          enableSearch,
        },
      }
      // Clear input immediately so it doesn't linger during streaming
      setInput("")
      clearDraft()
      await sendMessage({ role: "user", parts } as any, options as any)

      if (messages.length > 0) {
        bumpChat(currentChatId)
      }
    } catch {
      toast({ title: "Failed to send message", status: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    user,
    files,
    input,
    setInput,
    setFiles,
    checkLimitsAndNotify,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    clearDraft,
    messages.length,
    bumpChat,
    setIsSubmitting,
    sendMessage,
  ])

  // Handle suggestion
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true)

      try {
        const uid = await getOrCreateGuestUserId(user)
        if (!uid) return

        const allowed = await checkLimitsAndNotify(uid)
        if (!allowed) return

        const currentChatId = await ensureChatExists(uid, suggestion)
        if (!currentChatId) return

        const options = {
          body: {
            chatId: currentChatId,
            userId: uid,
            model: selectedModel,
            isAuthenticated,
            systemPrompt: SYSTEM_PROMPT_DEFAULT,
          },
        }

        await sendMessage({ role: "user", parts: [{ type: "text", text: suggestion }] } as any, options as any)
      } catch {
        toast({ title: "Failed to send suggestion", status: "error" })
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      ensureChatExists,
      selectedModel,
      user,
      sendMessage,
      checkLimitsAndNotify,
      isAuthenticated,
      setIsSubmitting,
    ]
  )

  // Handle reload
  const handleReload = useCallback(async () => {
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return
    }

    const options = {
      body: {
        chatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
      },
    }

    regenerate(options as any)
  }, [user, chatId, selectedModel, isAuthenticated, systemPrompt, regenerate])

  // Handle input change - now with access to the real setInput function!
  const { setDraftValue } = useChatDraft(chatId)
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      setDraftValue(value)
    },
    [setInput, setDraftValue]
  )

  return {
    // Chat state
    messages,
    input,
    status,
    error,
    reload: regenerate,
    stop,
    setMessages,
    setInput,
    append: sendMessage,
    isAuthenticated,
    systemPrompt,
    hasSentFirstMessageRef,

    // Component state
    isSubmitting,
    setIsSubmitting,
    hasDialogAuth,
    setHasDialogAuth,
    enableSearch,
    setEnableSearch,
    usageData,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
  }
}
