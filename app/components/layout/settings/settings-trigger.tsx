"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { User } from "@phosphor-icons/react"
import type React from "react"
import { useEffect, useState } from "react"
import { SettingsContent, type TabType } from "./settings-content"

type SettingsTriggerProps = {
  onOpenChange: (open: boolean) => void
}

export function SettingsTrigger({ onOpenChange }: SettingsTriggerProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("general")
  const isMobile = useBreakpoint(768)

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    onOpenChange(isOpen)
  }

  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: TabType }>
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab)
      }
      setOpen(true)
    }

    window.addEventListener('openSettings', handleOpenSettings)
    return () => {
      window.removeEventListener('openSettings', handleOpenSettings)
    }
  }, [])

  const trigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      <User className="size-4" />
      <span>Settings</span>
    </DropdownMenuItem>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <SettingsContent isDrawer activeTab={activeTab} />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-alpha-1 flex h-[80%] min-h-[480px] w-full flex-row gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[860px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your account, appearance, and connection settings.
        </DialogDescription>
        <SettingsContent activeTab={activeTab} />
      </DialogContent>
    </Dialog>
  )
}
