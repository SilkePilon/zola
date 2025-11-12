"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Camera, Stack, CaretRight } from "@phosphor-icons/react"
import { Paperclip } from "@/components/animate-ui/icons/paperclip"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import React, { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { UseProjectSubmenu } from "./submenu-use-project"
import { PopoverContentAuth } from "./popover-content-auth"

type ButtonFilesMenuProps = {
  onFileUpload: (files: File[]) => void
  isUserAuthenticated: boolean
  disabled?: boolean
}

export function ButtonFilesMenu({
  onFileUpload,
  isUserAuthenticated,
  disabled = false,
}: ButtonFilesMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showProjectSubmenu, setShowProjectSubmenu] = useState(false)

  const handleFileUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.accept = "image/*,text/*,.txt,.md,.pdf"
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      if (files.length > 0) {
        onFileUpload(files)
        setIsOpen(false)
      }
    }
    input.click()
  }

  const handleScreenshot = async () => {
    try {
      // Check if the browser supports the Screen Capture API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("Screenshot capture is not supported in your browser")
        setIsOpen(false)
        return
      }

      // Capture the screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" } as MediaTrackConstraints,
      })

      // Create a video element to capture the frame
      const video = document.createElement("video")
      video.srcObject = stream
      video.play()

      // Wait for the video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve
      })

      // Create a canvas and capture the current frame
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(video, 0, 0)

      // Stop the stream
      stream.getTracks().forEach((track) => track.stop())

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          // Create a File object from the blob
          const file = new File([blob], `screenshot-${Date.now()}.png`, {
            type: "image/png",
          })
          onFileUpload([file])
        }
      }, "image/png")
    } catch (error) {
      // User cancelled or error occurred
      console.log("Screenshot cancelled or failed:", error)
    } finally {
      setIsOpen(false)
    }
  }

  const handleProject = () => {
    setShowProjectSubmenu(true)
  }

  // If user is not authenticated, show the auth popover
  if (!isUserAuthenticated) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className={cn(
                  "border-border dark:bg-secondary size-9 rounded-[8px] border bg-transparent transition-all hover:bg-bg-100 active:scale-[0.98]"
                )}
                type="button"
                aria-label="Open attachments menu"
              >
                <Paperclip className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Open attachments menu</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setShowProjectSubmenu(false);
      }
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className={cn(
                "border-border dark:bg-secondary size-9 rounded-[8px] border bg-transparent transition-all hover:bg-bg-100 active:scale-[0.98]",
                disabled && "opacity-50 pointer-events-none"
              )}
              type="button"
              aria-label="Open attachments menu"
              aria-pressed={isOpen}
              disabled={disabled}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <AnimateIcon animate={isHovered}>
                <Paperclip className="size-4" />
              </AnimateIcon>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Open attachments menu</TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[14rem] max-w-[calc(100vw-16px)] p-1.5"
      >
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait">
            {!showProjectSubmenu ? (
              <motion.div
                key="main"
                initial={{ x: 0, opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <DropdownMenuItem onClick={handleFileUpload} className="gap-2.5 h-8 cursor-pointer">
                  <Paperclip className="size-4" />
                  <span>Upload a file</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleScreenshot} className="gap-2.5 h-8 cursor-pointer">
                  <Camera className="size-4" />
                  <span>Take a screenshot</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="mx-1.5" />

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleProject();
                  }}
                  className="gap-2.5 h-8 cursor-pointer"
                >
                  <Stack className="size-4" />
                  <span>Use a project</span>
                  <CaretRight className="ml-auto size-4 opacity-50" />
                </DropdownMenuItem>
              </motion.div>
            ) : (
              <UseProjectSubmenu
                key="project-submenu"
                onBack={() => setShowProjectSubmenu(false)}
                onClose={() => setIsOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
