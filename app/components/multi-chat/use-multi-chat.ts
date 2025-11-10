// todo: fix this
/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "@/components/ui/toast"
import { useMCP } from "@/lib/mcp-store"
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai"
import { useMemo } from "react"

type ModelConfig = {
  id: string
  name: string
  provider: string
}

type ModelChat = {
  model: ModelConfig
  messages: any[]
  isLoading: boolean
  append: (message: any, options?: any) => void
  stop: () => void
  completionTime?: number
}

// Maximum number of models we support
const MAX_MODELS = 10

const completionTimes: Record<number, number> = {}
const startTimes: Record<number, number> = {}

export function useMultiChat(models: ModelConfig[]): ModelChat[] {
  // Create a fixed number of useChat hooks to avoid conditional hook calls
  const chatHooks = Array.from({ length: MAX_MODELS }, (_, index) =>
    // todo: fix this
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useChat({
      onError: (error) => {
        const model = models[index]
        if (model) {
          console.error(`Error with ${model.name}:`, error)
          toast({
            title: `Error with ${model.name}`,
            description: error.message,
            status: "error",
          })
        }
      },
      onFinish: () => {
        if (startTimes[index]) {
          completionTimes[index] = Date.now() - startTimes[index]
        }
      },
      transport: new DefaultChatTransport({ api: "/api/chat" })
    })
  )

  // Map only the provided models to their corresponding chat hooks
  const activeChatInstances = useMemo(() => {
    const instances = models.slice(0, MAX_MODELS).map((model, index) => {
      const chatHook = chatHooks[index]
      const isLoading = chatHook.status === 'streaming'

      return {
        model,
        messages: chatHook.messages,
        isLoading,
        append: (message: any, options?: any) => {
          startTimes[index] = Date.now()
          completionTimes[index] = 0
          return chatHook.sendMessage(message, options as any)
        },
        stop: chatHook.stop,
        completionTime: isLoading ? undefined : completionTimes[index],
      }
    })

    return instances
    // todo: fix this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, ...chatHooks.flatMap((chat) => [chat.messages, chat.status])])

  return activeChatInstances
}
