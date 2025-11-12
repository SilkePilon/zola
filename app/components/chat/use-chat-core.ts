import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { Attachment } from "@/lib/file-handling"
import { API_ROUTE_CHAT } from "@/lib/routes"
import type { UserProfile } from "@/lib/user/types"
import { useMCP } from "@/lib/mcp-store"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type BudgetErrorState = {
  open: boolean
  budgetType: "monthly" | "daily" | "per_chat"
  spent: number
  limit: number
  provider?: string
} | null

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
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [usageData, setUsageData] = useState<{
    inputTokens: number
    outputTokens: number
    totalTokens: number
  } | undefined>(undefined)

  // MCP store
  const { servers: mcpServers } = useMCP()

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(chatId)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // Sync activeChatId with chatId from session
  useEffect(() => {
    if (chatId) {
      setActiveChatId(chatId)
    }
  }, [chatId])

  // Search params handling
  const searchParams = useSearchParams()
  const prompt = searchParams.get("prompt")

  // Budget error dialog state
  const [budgetError, setBudgetError] = useState<BudgetErrorState>(null)

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    let errorMsg = error.message || "Something went wrong."

    // Check if this is a budget error
    if (errorMsg.includes("budget limit exceeded")) {
      // Parse budget error details
      const budgetTypeMatch = errorMsg.match(/(Monthly|Daily|Per-chat) budget limit exceeded/i)
      const spentMatch = errorMsg.match(/spent \$([0-9.]+)/)
      const limitMatch = errorMsg.match(/of your \$([0-9.]+)/)
      const providerMatch = errorMsg.match(/for ([a-zA-Z0-9]+)/)

      if (budgetTypeMatch && spentMatch && limitMatch) {
        const budgetTypeMap: Record<string, "monthly" | "daily" | "per_chat"> = {
          monthly: "monthly",
          daily: "daily",
          "per-chat": "per_chat",
        }

        setBudgetError({
          open: true,
          budgetType: budgetTypeMap[budgetTypeMatch[1].toLowerCase()] || "monthly",
          spent: parseFloat(spentMatch[1]),
          limit: parseFloat(limitMatch[1]),
          provider: providerMatch?.[1],
        })
        return
      }
    }

    if (errorMsg === "An error occurred" || errorMsg === "fetch failed") {
      errorMsg = "Something went wrong. Please try again."
    }

    toast({
      title: errorMsg,
      status: "error",
    })
  }, [])

  const [input, setInput] = useState('')

  // Initialize useChat without initial messages (we'll set them in useEffect)
  const {
    messages,
    status,
    error,
    regenerate,
    stop,
    setMessages,
    sendMessage,
  } = useChat({
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
      // Keep messages as-is for display - just remove extra DB fields
      const cleanMessages = initialMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        parts: msg.parts,
      }))
      setMessages(cleanMessages as any[])
    }
  }, [initialMessages, messages.length, setMessages])

  // Reset messages when navigating from a chat to home (run outside render)
  useEffect(() => {
    if (prevChatIdRef.current !== null && chatId === null && messages.length > 0) {
      setMessages([])
      setActiveChatId(null)
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

      // Use activeChatId if available, otherwise create/get chatId
      let currentChatId = activeChatId || chatId
      
      if (!currentChatId) {
        currentChatId = await ensureChatExists(uid, input)
        if (!currentChatId) {
          return
        }
        // Store the newly created chatId for subsequent messages
        setActiveChatId(currentChatId)
      }

      if (input.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        return
      }

      // Convert File[] to FileList if we have files
      let fileList: FileList | undefined = undefined
      if (submittedFiles.length > 0) {
        const dataTransfer = new DataTransfer()
        submittedFiles.forEach(file => dataTransfer.items.add(file))
        fileList = dataTransfer.files
      }

      const options: any = {
        body: {
          chatId: currentChatId,
          userId: uid,
          model: selectedModel,
          isAuthenticated,
          systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
          enableSearch,
          mcpServers,
        },
      }
      
      // Clear input immediately
      setInput("")
      clearDraft()
      
      // Send message with files
      await sendMessage({ 
        text: input,
        files: fileList
      } as any, options)

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
    mcpServers,
    clearDraft,
    messages.length,
    bumpChat,
    setIsSubmitting,
    sendMessage,
    activeChatId,
    chatId,
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
    budgetError,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
    setBudgetError,
  }
}
