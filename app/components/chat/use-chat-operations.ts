import { toast } from "@/components/ui/toast"
import type { Chats } from "@/lib/chat-store/types"
import { deleteMessagesFromIdForChat } from "@/lib/chat-store/messages/api"
import { useCallback } from "react"

type UseChatOperationsProps = {
  isAuthenticated: boolean
  chatId: string | null
  messages: any[]
  selectedModel: string
  systemPrompt: string
  createNewChat: (
    userId: string,
    title?: string,
    model?: string,
    isAuthenticated?: boolean,
    systemPrompt?: string
  ) => Promise<Chats | undefined>
  setHasDialogAuth: (value: boolean) => void
  setMessages: (
    messages: any[] | ((messages: any[]) => any[])
  ) => void
  setInput: (input: string) => void
}

export function useChatOperations({
  isAuthenticated,
  chatId,
  messages,
  selectedModel,
  systemPrompt,
  createNewChat,
  setHasDialogAuth,
  setMessages,
}: UseChatOperationsProps) {

  // Message handlers
  const handleDelete = useCallback(
    async (id: string) => {
      // Find the index of the message to delete
      const messageIndex = messages.findIndex((message) => message.id === id)
      
      if (messageIndex === -1) return
      
      // Get the remaining messages (before the deleted message)
      const remainingMessages = messages.slice(0, messageIndex)
      
      // Calculate how many messages are being deleted
      const deletedCount = messages.length - messageIndex
      
      // Delete from database if we have a chatId
      if (chatId) {
        try {
          await deleteMessagesFromIdForChat(chatId, id, remainingMessages)
        } catch (error) {
          console.error("Failed to delete messages from database:", error)
          toast({
            title: "Failed to delete messages",
            status: "error",
          })
          return
        }
      }
      
      // Update local state
      setMessages(remainingMessages)
      
      // Show success notification
      toast({
        title: deletedCount === 1 ? "Message deleted" : `${deletedCount} messages deleted`,
        status: "success",
      })
    },
    [chatId, messages, setMessages]
  )

  const handleEdit = useCallback(
    (id: string, newText: string) => {
      setMessages(
        messages.map((message) =>
          message.id === id ? { ...message, content: newText } : message
        )
      )
    },
    [messages, setMessages]
  )

  return {
    // Handlers
    handleDelete,
    handleEdit,
  }
}
