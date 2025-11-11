"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useChats } from "@/lib/chat-store/chats/provider"
import { clearMessagesForChat } from "@/lib/chat-store/messages/api"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { cn } from "@/lib/utils"
import { ListMagnifyingGlass } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CommandHistory } from "./command-history"
import { DrawerHistory } from "./drawer-history"

type HistoryTriggerProps = {
  hasSidebar: boolean
  classNameTrigger?: string
  icon?: React.ReactNode
  label?: React.ReactNode | string
  hasPopover?: boolean
}

export function HistoryTrigger({
  hasSidebar,
  classNameTrigger,
  icon,
  label,
  hasPopover = true,
}: HistoryTriggerProps) {
  const isMobile = useBreakpoint(768)
  const router = useRouter()
  const { chats, updateTitle, deleteChat } = useChats()
  const [isOpen, setIsOpen] = useState(false)
  const { chatId } = useChatSession()

  const handleSaveEdit = async (id: string, newTitle: string) => {
    await updateTitle(id, newTitle)
  }

  const handleConfirmDelete = async (id: string) => {
    const isCurrentChat = id === chatId
    
    try {
      // Delete messages for the specific chat being deleted
      await clearMessagesForChat(id)
      
      // Delete the chat with redirect if it's the current chat
      if (isCurrentChat) {
        await deleteChat(id, chatId ?? undefined, () => router.push("/"))
        // Close the dialog when deleting current chat since we're navigating away
        setIsOpen(false)
      } else {
        await deleteChat(id, chatId ?? undefined)
        // Keep dialog open when deleting other chats
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
      const { toast } = await import("@/components/ui/toast")
      toast({
        title: "Failed to delete chat",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        status: "error",
      })
    }
  }

  const defaultTrigger = (
    <button
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted bg-background pointer-events-auto rounded-full p-1.5 transition-colors",
        hasSidebar ? "hidden" : "block",
        classNameTrigger
      )}
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label="Search"
      tabIndex={isMobile ? -1 : 0}
    >
      {icon || <ListMagnifyingGlass size={24} />}
      {label}
    </button>
  )

  if (isMobile) {
    return (
      <DrawerHistory
        chatHistory={chats}
        onSaveEdit={handleSaveEdit}
        onConfirmDelete={handleConfirmDelete}
        trigger={defaultTrigger}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
    )
  }

  return (
    <CommandHistory
      chatHistory={chats}
      onSaveEdit={handleSaveEdit}
      onConfirmDelete={handleConfirmDelete}
      trigger={defaultTrigger}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onOpenChange={setIsOpen}
      hasPopover={hasPopover}
    />
  )
}
