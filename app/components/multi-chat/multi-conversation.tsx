"use client"

import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/prompt-kit/chat-container"
import { Loader } from "@/components/prompt-kit/loader"
import { ScrollButton } from "@/components/prompt-kit/scroll-button"
import ProviderIcon from "@/components/common/provider-icon"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import { useEffect, useState } from "react"
import { Message } from "../chat/message"

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

type MultiModelConversationProps = {
  messageGroups: GroupedMessage[]
}

type ResponseCardProps = {
  response: GroupedMessage["responses"][0]
  group: GroupedMessage
}

function ResponseCard({ response, group }: ResponseCardProps) {
  const formatTime = (ms?: number) => {
    if (!ms) return null
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  /* FIXME(@ai-sdk-upgrade-v5): The `experimental_attachments` property has been replaced with the parts array. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#attachments--file-parts */
  return (
    <div className="relative h-full">
      <div className="bg-background pointer-events-auto relative rounded-[8px] border h-full flex flex-col">
        {/* Header with model info and completion time */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ProviderIcon 
              providerId={response.modelIcon}
              logoUrl={response.modelLogoUrl}
              className="size-5"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{response.modelName}</span>
              <span className="text-muted-foreground text-xs">{response.provider}</span>
            </div>
          </div>
          {(response.completionTime !== undefined && response.completionTime > 0) && (
            <div className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
              <span>{formatTime(response.completionTime)}</span>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4">

          {response.message ? (
            // Derive text from parts (v5) with legacy fallback
            (() => {
              const text =
                response.message.parts?.map((p: any) =>
                  p.type === "text" ? p.text : ""
                ).join("") ?? (response.message as any).content ?? ""
              return (
            <Message
              id={response.message.id}
              variant="assistant"
              parts={response.message.parts}
              onDelete={() => group.onDelete(response.model, response.message.id)}
              onEdit={(id, newText) => group.onEdit(response.model, id, newText)}
              onReload={() => group.onReload(response.model)}
              status={response.isLoading ? "streaming" : "ready"}
              isLast={false}
              hasScrollAnchor={false}
              className="bg-transparent p-0 px-0"
            >
              {text}
            </Message>
              );
            })()
          ) : response.isLoading ? (
            <Loader />
          ) : (
            <div className="text-muted-foreground text-sm italic">
              Waiting for response...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MultiModelConversation({
  messageGroups,
}: MultiModelConversationProps) {
  // State to manage the order of responses for each group
  const [groupResponses, setGroupResponses] = useState<
    Record<number, GroupedMessage["responses"]>
  >(() => {
    const initial: Record<number, GroupedMessage["responses"]> = {}
    messageGroups.forEach((group, index) => {
      initial[index] = [...group.responses]
    })
    return initial
  })

  // Update group responses when messageGroups changes
  useEffect(() => {
    const updated: Record<number, GroupedMessage["responses"]> = {}
    messageGroups.forEach((group, index) => {
      updated[index] = [...group.responses]
    })
    setGroupResponses(updated)
  }, [messageGroups])

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-y-auto">
      <ChatContainerRoot className="relative w-full">
        <ChatContainerContent
          className="flex w-full flex-col items-center pt-20 pb-[134px]"
          style={{
            scrollbarGutter: "stable both-edges",
            scrollbarWidth: "none",
          }}
        >
          {messageGroups.length === 0
            ? null
            : messageGroups.map((group, groupIndex) => {
                /* FIXME(@ai-sdk-upgrade-v5): The `experimental_attachments` property has been replaced with the parts array. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#attachments--file-parts */
                return (
                  <div key={groupIndex} className="mb-10 w-full space-y-3">
                    <div className="mx-auto w-full max-w-3xl">
                      {/* Derive user text from parts (v5) with legacy fallback */}
                      <Message
                        id={group.userMessage.id}
                        variant="user"
                        parts={group.userMessage.parts}
                        onDelete={() => {}}
                        onEdit={() => {}}
                        onReload={() => {}}
                        status="ready"
                      >
                        {(
                          group.userMessage.parts?.map((p: any) =>
                            p.type === "text" ? p.text : ""
                          ).join("") ?? (group.userMessage as any).content ?? ""
                        )}
                      </Message>
                    </div>
                    <div
                      className={cn(
                        "mx-auto w-full",
                        groupResponses[groupIndex]?.length === 1
                          ? "max-w-3xl"
                          : groupResponses[groupIndex]?.length === 2
                          ? "max-w-[1400px]"
                          : "max-w-[1800px]"
                      )}
                    >
                      <div className={cn(
                        "pl-6",
                        groupResponses[groupIndex]?.length === 1 ? "" : "overflow-x-auto"
                      )}>
                        <div className={cn(
                          "gap-4",
                          groupResponses[groupIndex]?.length === 1
                            ? "flex"
                            : groupResponses[groupIndex]?.length === 2
                            ? "grid grid-cols-2"
                            : "flex"
                        )}>
                          {(groupResponses[groupIndex] || group.responses).map(
                            (response) => {
                              return (
                                <div
                                  key={response.model}
                                  className={cn(
                                    groupResponses[groupIndex]?.length === 1
                                      ? "w-full"
                                      : groupResponses[groupIndex]?.length === 2
                                      ? "min-h-[200px]"
                                      : "max-w-[420px] min-w-[380px] flex-shrink-0"
                                  )}
                                >
                                  <ResponseCard
                                    response={response}
                                    group={group}
                                  />
                                </div>
                              )
                            }
                          )}
                          {/* Spacer to create scroll padding - only when more than 2 items */}
                          {groupResponses[groupIndex]?.length > 2 && (
                            <div className="w-px flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          <div className="absolute right-0 bottom-32 flex w-full max-w-3xl flex-1 items-end justify-end gap-4 pb-2 pl-6">
            <ScrollButton className="absolute top-[-50px] right-[30px]" />
          </div>
        </ChatContainerContent>
      </ChatContainerRoot>
    </div>
  );
}
