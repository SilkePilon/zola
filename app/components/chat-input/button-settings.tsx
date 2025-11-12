"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { PaintBrush, Plus, Gear, CaretRight } from "@phosphor-icons/react"
import { SlidersVertical } from "@/components/animate-ui/icons/sliders-vertical"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import React, { useState } from "react"
import { UseStyleSubmenu } from "./submenu-use-style"
import { MCPServersSubmenu } from "./submenu-mcp-servers"
import { motion, AnimatePresence } from "framer-motion"

type ButtonSettingsProps = {
  disabled?: boolean
}

export function ButtonSettings({ disabled = false }: ButtonSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [mcpSubmenuOpen, setMcpSubmenuOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleUseStyle = () => {
    setSubmenuOpen(true)
  }

  const handleManageMCPServers = () => {
    setMcpSubmenuOpen(true)
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
              aria-label="Open tools menu"
              aria-pressed={isOpen}
              disabled={disabled}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <AnimateIcon animate={isHovered}>
                <SlidersVertical className="size-4" />
              </AnimateIcon>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Open tools menu</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[20rem] max-w-[calc(100vw-16px)] overflow-hidden"
      >
        <div className="flex flex-col relative">
          <AnimatePresence mode="wait" initial={false}>
            {!submenuOpen && !mcpSubmenuOpen ? (
              <motion.div
                key="main-menu"
                initial={{ x: 0, opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex flex-col p-1.5"
              >
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault()
                    handleUseStyle()
                  }}
                  onSelect={(e) => e.preventDefault()}
                  className="gap-2.5 h-8 cursor-pointer"
                >
                  <PaintBrush className="size-4" />
                  <span>Use style</span>
                  <CaretRight className="ml-auto size-4 opacity-50" />
                </DropdownMenuItem>

                <DropdownMenuSeparator className="mx-1.5" />

                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault()
                    handleManageMCPServers()
                  }}
                  onSelect={(e) => e.preventDefault()}
                  className="gap-2.5 h-8 cursor-pointer"
                >
                  <Gear className="size-4" />
                  <span>Manage MCP servers</span>
                  <CaretRight className="ml-auto size-4 opacity-50" />
                </DropdownMenuItem>
              </motion.div>
            ) : submenuOpen ? (
              <UseStyleSubmenu
                isOpen={submenuOpen}
                onClose={() => setSubmenuOpen(false)}
              />
            ) : (
              <MCPServersSubmenu
                onBack={() => setMcpSubmenuOpen(false)}
                onClose={() => setIsOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
