"use client"

import { PaintBrush, ArrowLeft, Check, Plus } from "@phosphor-icons/react"
import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

type UseStyleSubmenuProps = {
  onClose: () => void
  isOpen: boolean
}

const STYLES = [
  { id: "normal", label: "Normal", selected: true },
  { id: "learning", label: "Learning", selected: false },
  { id: "concise", label: "Concise", selected: false },
  { id: "explanatory", label: "Explanatory", selected: false },
  { id: "formal", label: "Formal", selected: false },
]

export function UseStyleSubmenu({ onClose, isOpen }: UseStyleSubmenuProps) {
  const [selectedStyle, setSelectedStyle] = useState("normal")

  return (
    <motion.div
      key="submenu"
      initial={{ x: 320, opacity: 1 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col w-full p-1.5"
    >
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault()
                  onClose()
                }}
                onSelect={(e) => e.preventDefault()}
                className="gap-2.5 h-8 cursor-pointer"
              >
                <ArrowLeft className="size-4 opacity-50" />
                <span className="opacity-60">Use style</span>
              </DropdownMenuItem>

              {STYLES.map((style) => (
                <DropdownMenuItem
                  key={style.id}
                  onClick={(e) => {
                    e.preventDefault()
                    setSelectedStyle(style.id)
                  }}
                  onSelect={(e) => e.preventDefault()}
                  className="gap-2.5 h-8 cursor-pointer"
                >
                  <PaintBrush className="size-4" />
                  <span>{style.label}</span>
                  {selectedStyle === style.id && (
                    <Check className="ml-auto size-4 text-accent-secondary-100" weight="bold" />
                  )}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator className="mx-1.5" />

              <DropdownMenuItem onClick={() => console.log("Create & edit styles")} className="gap-2.5 h-8 cursor-pointer">
                <Plus className="size-4" />
                <span>Create &amp; edit styles</span>
              </DropdownMenuItem>
    </motion.div>
  )
}
