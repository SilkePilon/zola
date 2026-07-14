"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { clearMessagesForChat } from "@/lib/chat-store/messages/api"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { TrashSimple } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const HISTORY_MANAGEMENT_ROW_ID = "settings-row-general-history"

export function HistoryManagement() {
  const { chats, deleteChat } = useChats()
  const { chatId } = useChatSession()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAll = useCallback(async () => {
    if (isDeleting) return

    const confirm = window.confirm(
      "Delete all chat history? This removes all non-pinned conversations."
    )
    if (!confirm) return

    try {
      setIsDeleting(true)
      const deletable = chats.filter((c) => !c.pinned && !c.project_id)

      for (const chat of deletable) {
        try {
          await clearMessagesForChat(chat.id)
        } catch (e) {
          console.error("Failed clearing messages for", chat.id, e)
        }
        try {
          await deleteChat(chat.id, chatId || undefined, () => router.push("/"))
        } catch (e) {
          console.error("Failed deleting chat", chat.id, e)
        }
      }

      toast({ title: "History cleared" })
    } catch (e) {
      console.error(e)
      toast({ title: "Failed to clear history", status: "error" })
    } finally {
      setIsDeleting(false)
    }
  }, [isDeleting, chats, deleteChat, chatId, router])

  return (
    <SettingsSection title="History">
      <SettingsRow
        id={HISTORY_MANAGEMENT_ROW_ID}
        title="Clear history"
        description="Remove all non-pinned conversations from your history."
      >
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleDeleteAll}
          disabled={isDeleting}
        >
          <TrashSimple className="size-4" />
          <span>{isDeleting ? "Deleting..." : "Delete All"}</span>
        </Button>
      </SettingsRow>
    </SettingsSection>
  )
}
