"use client"

import { MultiModelConversation } from "@/app/components/multi-chat/multi-conversation"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { useMCP } from "@/lib/mcp-store"
import { useModel } from "@/lib/model-store/provider"
import { useUser } from "@/lib/user-store/provider"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useMemo, useState } from "react"
import { MultiChatInput } from "./multi-chat-input"
import { useMultiChat } from "./use-multi-chat"

type GroupedMessage = {
  userMessage: UIMessage
  responses: {
    model: string
    modelName: string
    modelIcon?: string
    modelLogoUrl?: string
    message: UIMessage
    isLoading?: boolean
    provider: string
    completionTime?: number
  }[]
  onDelete: (model: string, id: string) => void
  onEdit: (model: string, id: string, newText: string) => void
  onReload: (model: string) => void
}

export function MultiChat() {
  const [prompt, setPrompt] = useState("")
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [multiChatId, setMultiChatId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user } = useUser()
  const { models } = useModel()
  const { servers: mcpServers } = useMCP()
  const { chatId } = useChatSession()
  const { messages: persistedMessages, isLoading: messagesLoading } =
    useMessages()
  const { createNewChat } = useChats()

  const availableModels = useMemo(() => {
    return models.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
    }))
  }, [models])

  const modelsFromPersisted = useMemo(() => {
    const safe = (persistedMessages || []).filter(Boolean) as UIMessage[]
    return safe
      .filter((msg) => (msg as any).model)
      .map((msg) => (msg as any).model as string)
  }, [persistedMessages])

  const modelsFromLastGroup = useMemo(() => {
    const safe = (persistedMessages || []).filter(Boolean) as UIMessage[]
    const userMessages = safe.filter((msg) => msg.role === "user")
    if (userMessages.length === 0) return []

    const lastUserMessage = userMessages[userMessages.length - 1]
    const lastUserIndex = safe.indexOf(lastUserMessage)

    const modelsInLastGroup: string[] = []
    for (let i = lastUserIndex + 1; i < safe.length; i++) {
      const msg = safe[i]
      if (!msg) continue
      if (msg.role === "user") break
      if (msg.role === "assistant" && (msg as any).model) {
        modelsInLastGroup.push((msg as any).model as string)
      }
    }
    return modelsInLastGroup
  }, [persistedMessages])

  const allModelsToMaintain = useMemo(() => {
    const combined = [...new Set([...selectedModelIds, ...modelsFromPersisted])]
    return availableModels.filter((model) => combined.includes(model.id))
  }, [availableModels, selectedModelIds, modelsFromPersisted])

  if (selectedModelIds.length === 0 && modelsFromLastGroup.length > 0) {
    setSelectedModelIds(modelsFromLastGroup)
  }

  const modelChats = useMultiChat(allModelsToMaintain)
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])

  const getText = (m: UIMessage) =>
    m.parts?.map((p: any) => (p.type === "text" ? p.text : "")).join("") ||
    ((m as any).content ?? "")

  const createPersistedGroups = useCallback(() => {
    const persistedGroups: { [key: string]: GroupedMessage } = {}

    const safe = (persistedMessages || []).filter(Boolean) as UIMessage[]
    if (safe.length === 0) return persistedGroups

    const groups: {
      [key: string]: {
        userMessage: UIMessage
        assistantMessages: UIMessage[]
      }
    } = {}

    for (let i = 0; i < safe.length; i++) {
      const message = safe[i]
      if (!message) continue

      if (message.role === "user") {
        const groupKey = getText(message)
        if (!groups[groupKey]) {
          groups[groupKey] = {
            userMessage: message,
            assistantMessages: [],
          }
        }
      } else if (message.role === "assistant") {
        let associatedUserMessage = null
        for (let j = i - 1; j >= 0; j--) {
          const prev = safe[j]
          if (!prev) continue
          if (prev.role === "user") {
            associatedUserMessage = prev
            break
          }
        }

        if (associatedUserMessage) {
          const groupKey = getText(associatedUserMessage)
          if (!groups[groupKey]) {
            groups[groupKey] = {
              userMessage: associatedUserMessage,
              assistantMessages: [],
            }
          }
          groups[groupKey].assistantMessages.push(message)
        }
      }
    }

    Object.entries(groups).forEach(([groupKey, group]) => {
      if (group.userMessage) {
        persistedGroups[groupKey] = {
          userMessage: group.userMessage,
          responses: group.assistantMessages.map((msg, index) => {
            const modelId =
              (msg as any).model || selectedModelIds[index] || `model-${index}`
            const modelInfo = models.find((m) => m.id === modelId)
            const provider = modelInfo?.provider || "unknown"

            return {
              model: modelId,
              modelName: modelInfo?.name || modelId,
              modelIcon: modelInfo?.baseProviderId,
              modelLogoUrl: modelInfo?.logoUrl,
              message: msg,
              isLoading: false,
              provider,
            }
          }),
          onDelete: () => {},
          onEdit: () => {},
          onReload: () => {},
        }
      }
    })

    return persistedGroups
  }, [persistedMessages, selectedModelIds, models])

  const messageGroups = useMemo(() => {
    const persistedGroups = createPersistedGroups()
    const liveGroups = { ...persistedGroups }

    modelChats.forEach((chat) => {
      for (let i = 0; i < chat.messages.length; i += 2) {
        const userMsg = chat.messages[i]
        const assistantMsg = chat.messages[i + 1]

        if (userMsg?.role === "user") {
          const groupKey = getText(userMsg)

          if (!liveGroups[groupKey]) {
            liveGroups[groupKey] = {
              userMessage: userMsg,
              responses: [],
              onDelete: () => {},
              onEdit: () => {},
              onReload: () => {},
            }
          }

          if (assistantMsg?.role === "assistant") {
            const existingResponse = liveGroups[groupKey].responses.find(
              (r) => r.model === chat.model.id
            )

            if (!existingResponse) {
              const modelInfo = models.find(m => m.id === chat.model.id)
              liveGroups[groupKey].responses.push({
                model: chat.model.id,
                modelName: chat.model.name,
                modelIcon: modelInfo?.baseProviderId,
                modelLogoUrl: modelInfo?.logoUrl,
                message: assistantMsg,
                isLoading: false,
                provider: chat.model.provider,
                completionTime: chat.completionTime,
              })
            }
          } else if (
            chat.isLoading &&
            getText(userMsg) === prompt &&
            selectedModelIds.includes(chat.model.id)
          ) {
            const placeholderMessage: UIMessage = {
              id: `loading-${chat.model.id}`,
              role: "assistant",
              parts: [{ type: "text", text: "" }],
            }
            const modelInfo = models.find(m => m.id === chat.model.id)
            liveGroups[groupKey].responses.push({
              model: chat.model.id,
              modelName: chat.model.name,
              modelIcon: modelInfo?.baseProviderId,
              modelLogoUrl: modelInfo?.logoUrl,
              message: placeholderMessage,
              isLoading: true,
              provider: chat.model.provider,
              completionTime: undefined,
            })
          }
        }
      }
    })

    return Object.values(liveGroups)
  }, [createPersistedGroups, modelChats, prompt, selectedModelIds])

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) return

    if (selectedModelIds.length === 0) {
      toast({
        title: "No models selected",
        description: "Please select at least one model to chat with.",
        status: "error",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const uid = await getOrCreateGuestUserId(user)
      if (!uid) return

      const message_group_id = crypto.randomUUID()

      let chatIdToUse = multiChatId || chatId
      if (!chatIdToUse) {
        const createdChat = await createNewChat(
          uid,
          prompt,
          selectedModelIds[0],
          !!user?.id
        )
        if (!createdChat) {
          throw new Error("Failed to create chat")
        }
        chatIdToUse = createdChat.id
        setMultiChatId(chatIdToUse)
        window.history.pushState(null, "", `/c/${chatIdToUse}`)
      }

      const selectedChats = modelChats.filter((chat) =>
        selectedModelIds.includes(chat.model.id)
      )

      await Promise.all(
        selectedChats.map(async (chat) => {
          const options = {
            body: {
              chatId: chatIdToUse,
              userId: uid,
              model: chat.model.id,
              isAuthenticated: !!user?.id,
              systemPrompt: systemPrompt,
              enableSearch: false,
              message_group_id,
              mcpServers,
            },
          }

          // v5: send parts-based user message
          chat.append(
            {
              role: "user",
              parts: [{ type: "text", text: prompt }],
            },
            options
          )
        })
      )

      setPrompt("")
      setFiles([])
    } catch (error) {
      console.error("Failed to send message:", error)
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        status: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    prompt,
    selectedModelIds,
    user,
    modelChats,
    systemPrompt,
    multiChatId,
    chatId,
    createNewChat,
  ])

  const handleFileUpload = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleFileRemove = useCallback((fileToRemove: File) => {
    setFiles((prev) => prev.filter((file) => file !== fileToRemove))
  }, [])

  const handleStop = useCallback(() => {
    modelChats.forEach((chat) => {
      if (chat.isLoading && selectedModelIds.includes(chat.model.id)) {
        chat.stop()
      }
    })
  }, [modelChats, selectedModelIds])

  const anyLoading = useMemo(
    () =>
      modelChats.some(
        (chat) => chat.isLoading && selectedModelIds.includes(chat.model.id)
      ),
    [modelChats, selectedModelIds]
  )

  const conversationProps = useMemo(() => ({ messageGroups }), [messageGroups])

  const inputProps = useMemo(
    () => ({
      value: prompt,
      onValueChange: setPrompt,
      onSend: handleSubmit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      selectedModelIds,
      onSelectedModelIdsChange: setSelectedModelIds,
      isUserAuthenticated: isAuthenticated,
      stop: handleStop,
      status: anyLoading ? ("streaming" as const) : ("ready" as const),
      anyLoading,
    }),
    [
      prompt,
      handleSubmit,
      isSubmitting,
      files,
      handleFileUpload,
      handleFileRemove,
      selectedModelIds,
      isAuthenticated,
      handleStop,
      anyLoading,
    ]
  )

  const showOnboarding = messageGroups.length === 0 && !messagesLoading

  return (
    <div
      className={cn(
        "@container/main relative flex h-full flex-col items-center",
        showOnboarding ? "justify-end md:justify-center" : "justify-end"
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {showOnboarding ? (
          <motion.div
            key="onboarding"
            className="absolute bottom-[60%] mx-auto max-w-[50rem] md:relative md:bottom-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            layout="position"
            layoutId="onboarding"
            transition={{ layout: { duration: 0 } }}
          >
            <h1 className="mb-6 text-3xl font-medium tracking-tight">
              What's on your mind?
            </h1>
          </motion.div>
        ) : (
          <motion.div
            key="conversation"
            className="w-full flex-1 overflow-hidden"
            layout="position"
            layoutId="conversation"
            transition={{
              layout: { duration: messageGroups.length === 1 ? 0.3 : 0 },
            }}
          >
            <MultiModelConversation {...conversationProps} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={cn(
          "z-50 mx-auto w-full max-w-3xl",
          showOnboarding ? "relative" : "absolute right-0 bottom-0 left-0"
        )}
        layout="position"
        layoutId="multi-chat-input-container"
        transition={{
          layout: { duration: messageGroups.length === 1 ? 0.3 : 0 },
        }}
      >
        <MultiChatInput {...inputProps} />
      </motion.div>
    </div>
  )
}
