import {
  FileUpload,
  FileUploadContent,
  FileUploadTrigger,
} from "@/components/prompt-kit/file-upload"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getModelInfo } from "@/lib/models"
import { useModel } from "@/lib/model-store/provider"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { cn } from "@/lib/utils"
import { FileArrowUp, Paperclip } from "@phosphor-icons/react"
import React from "react"
import { PopoverContentAuth } from "./popover-content-auth"
import { PopoverContentStorage } from "./popover-content-storage"
import { useUserPreferences } from "@/lib/user-preference-store/provider"

type ButtonFileUploadProps = {
  onFileUpload: (files: File[]) => void
  isUserAuthenticated: boolean
  model: string
  disabled?: boolean
}

export function ButtonFileUpload({
  onFileUpload,
  isUserAuthenticated,
  model,
  disabled = false,
}: ButtonFileUploadProps) {
  const { models } = useModel()
  const { preferences } = useUserPreferences()
  const hasStorageBucket = Boolean(preferences.storageBucket)
  
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            className="border-border dark:bg-secondary size-9 rounded-[8px] border bg-transparent opacity-50"
            type="button"
            aria-label="Add files"
            disabled
          >
            <Paperclip className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add files (disabled in multi-model)</TooltipContent>
      </Tooltip>
    )
  }
  if (!isSupabaseEnabled) {
    return null
  }

  // Derive accepted MIME types/extensions from model capabilities; text is always allowed
  // Prefer client model-store (authoritative in client), fallback to sync cache
  const info = models.find((m) => m.id === model) || getModelInfo(model)
  const allowImage = Boolean(info?.vision)
  const allowAudio = Boolean(info?.audio)
  const allowVideo = Boolean(info?.video)

  const textAccept = [".txt", ".md"]
  const imageAccept = [
    "image/*",
    // Keep explicit common types for broader compatibility
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/heic",
    "image/heif",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".heic",
    ".heif",
  ]
  const audioAccept = [
    "audio/*",
    "audio/mpeg",
    "audio/wav",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
    "audio/webm",
    "audio/flac",
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".ogg",
    ".webm",
    ".flac",
  ]
  const videoAccept = [
    "video/*",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
    "video/ogg",
    ".mp4",
    ".webm",
    ".mov",
    ".mkv",
    ".avi",
    ".ogv",
  ]

  const acceptParts: string[] = [...textAccept]
  if (allowImage) acceptParts.push(...imageAccept)
  if (allowAudio) acceptParts.push(...audioAccept)
  if (allowVideo) acceptParts.push(...videoAccept)
  const accept = acceptParts.join(",")

  // Filter dropped/selected files to allowed types/extensions (text always allowed)
  const handleFiles = (files: File[]) => {
    const filtered = files.filter((f) => {
      const name = f.name.toLowerCase()
      const type = f.type.toLowerCase()
      const hasExt = (ext: string) => name.endsWith(ext)
      const isText = type.startsWith("text/") || hasExt(".txt") || hasExt(".md")
      if (isText) return true
      if (allowImage && (type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".heic", ".heif"].some(hasExt))) return true
      if (allowAudio && (type.startsWith("audio/") || [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm", ".flac"].some(hasExt))) return true
      if (allowVideo && (type.startsWith("video/") || [".mp4", ".webm", ".mov", ".mkv", ".avi", ".ogv"].some(hasExt))) return true
      return false
    })
    if (filtered.length > 0) onFileUpload(filtered)
  }

  if (!isUserAuthenticated) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className="border-border dark:bg-secondary size-9 rounded-[8px] border bg-transparent"
                type="button"
                aria-label="Add files"
              >
                <Paperclip className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add files</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    )
  }

  // Show storage configuration prompt if bucket is not configured
  if (!hasStorageBucket) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className="border-border dark:bg-secondary size-9 rounded-[8px] border bg-transparent"
                type="button"
                aria-label="Add files"
              >
                <Paperclip className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add files</TooltipContent>
        </Tooltip>
        <PopoverContentStorage />
      </Popover>
    )
  }

  return (
    <FileUpload
      onFilesAdded={handleFiles}
      multiple
      disabled={!isUserAuthenticated}
      accept={accept}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <FileUploadTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className={cn(
                "border-border dark:bg-secondary size-9 rounded-[8px] border bg-transparent",
                !isUserAuthenticated && "opacity-50"
              )}
              type="button"
              disabled={!isUserAuthenticated}
              aria-label="Add files"
            >
              <Paperclip className="size-4" />
            </Button>
          </FileUploadTrigger>
        </TooltipTrigger>
        <TooltipContent>Add files</TooltipContent>
      </Tooltip>
      <FileUploadContent>
        <div className="border-input bg-background flex flex-col items-center rounded-lg border border-dashed p-8">
          <FileArrowUp className="text-muted-foreground size-8" />
          <span className="mt-4 mb-1 text-lg font-medium">Drop files here</span>
          <span className="text-muted-foreground text-sm">
            Drop any files here to add it to the conversation
          </span>
        </div>
      </FileUploadContent>
    </FileUpload>
  )
}
