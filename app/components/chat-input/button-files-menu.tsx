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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Plus, Camera, GithubLogo, Stack, CaretRight } from "@phosphor-icons/react"
import { Paperclip } from "@/components/animate-ui/icons/paperclip"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import React, { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { UseProjectSubmenu } from "./submenu-use-project"

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

  const handleScreenshot = () => {
    // Placeholder for screenshot functionality
    console.log("Screenshot feature")
    setIsOpen(false)
  }

  const handleGitHub = () => {
    // Placeholder for GitHub integration
    console.log("GitHub integration")
    setIsOpen(false)
  }

  const handleProject = () => {
    setShowProjectSubmenu(true)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
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
        className="w-[20rem] max-w-[calc(100vw-16px)] p-1.5"
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

                <DropdownMenuItem onClick={handleGitHub} className="gap-2.5 h-8 cursor-pointer">
                  <GithubLogo className="size-4" />
                  <span>Add from GitHub</span>
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
