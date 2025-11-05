"use client"

import { MultiModelSelector } from "@/components/common/multi-model-selector/base"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input"
import { Button } from "@/components/ui/button"
import { SendButtonIconAnimated } from "../chat-input/button-send-animated"
import { ButtonFileUpload } from "../chat-input/button-file-upload"
import { FileList } from "../chat-input/file-list"
import { Stop } from "@phosphor-icons/react"
import React, { useCallback } from "react"

type MultiChatInputProps = {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  isSubmitting?: boolean
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  selectedModelIds: string[]
  onSelectedModelIdsChange: (modelIds: string[]) => void
  isUserAuthenticated: boolean
  stop: () => void
  status?: "submitted" | "streaming" | "ready" | "error"
  anyLoading?: boolean
}

export function MultiChatInput({
  value,
  onValueChange,
  onSend,
  isSubmitting,
  files,
  onFileUpload,
  onFileRemove,
  selectedModelIds,
  onSelectedModelIdsChange,
  isUserAuthenticated,
  stop,
  status,
  anyLoading,
}: MultiChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)

  const handleSend = useCallback(() => {
    if (isSubmitting || anyLoading) {
      return
    }

    if (status === "streaming") {
      stop()
      return
    }

    onSend()
  }, [isSubmitting, anyLoading, onSend, status, stop])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSubmitting || anyLoading) {
        e.preventDefault()
        return
      }

      if (e.key === "Enter" && status === "streaming") {
        e.preventDefault()
        return
      }

      if (e.key === "Enter" && !e.shiftKey) {
        if (isOnlyWhitespace(value)) {
          return
        }

        e.preventDefault()
        onSend()
      }
    },
    [isSubmitting, anyLoading, onSend, status, value]
  )

  return (
    <div className="relative flex w-full flex-col gap-4">
      <div className="relative order-2 px-2 pb-3 sm:pb-4 md:order-1">
        <PromptInput
          className="bg-popover relative z-10 p-0 pt-1 shadow-xs backdrop-blur-xl"
          maxHeight={200}
          value={value}
          onValueChange={onValueChange}
        >
          <FileList files={files} onFileRemove={onFileRemove} />
          <PromptInputTextarea
            placeholder="Ask Zola"
            onKeyDown={handleKeyDown}
            className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
          />
          <PromptInputActions className="mt-3 w-full justify-between p-2">
            <div className="flex gap-2">
              <ButtonFileUpload
                onFileUpload={onFileUpload}
                isUserAuthenticated={isUserAuthenticated}
                model={selectedModelIds[0] || ""}
                disabled
              />
              <MultiModelSelector
                selectedModelIds={selectedModelIds}
                setSelectedModelIds={onSelectedModelIdsChange}
              />
            </div>
            <PromptInputAction
              tooltip={status === "streaming" ? "Stop" : "Send"}
            >
              <Button
                size="sm"
                className="size-9 rounded-md transition-all duration-300 ease-out"
                disabled={
                  !value ||
                  isSubmitting ||
                  anyLoading ||
                  isOnlyWhitespace(value) ||
                  selectedModelIds.length === 0
                }
                type="button"
                onClick={handleSend}
                aria-label={status === "streaming" ? "Stop" : "Send message"}
              >
                {status === "streaming" || anyLoading ? (
                  <SendButtonIconAnimated mode="responding" />
                ) : !isOnlyWhitespace(value) ? (
                  <SendButtonIconAnimated mode="typing" />
                ) : (
                  <SendButtonIconAnimated mode="idle" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}
