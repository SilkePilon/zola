"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { APP_NAME } from "@/lib/config"
import Image from "next/image"

type ApiKeyRequiredDialogProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  modelName: string
  providerName: string
}

export function ApiKeyRequiredDialog({
  isOpen,
  setIsOpen,
  modelName,
  providerName,
}: ApiKeyRequiredDialogProps) {
  const isMobile = useBreakpoint(768)

  const renderContent = () => (
    <div className="flex max-h-[70vh] flex-col" key={`${providerName}-${modelName}`}>
      <div className="relative">
        <Image
          src="/banner_ocean.jpg"
          alt={`calm paint generate by ${APP_NAME}`}
          width={400}
          height={128}
          className="h-32 w-full object-cover"
        />
      </div>

      <div className="px-6 pt-4 text-center text-lg leading-tight font-medium">
        API Key Required
      </div>

      <div className="flex-grow overflow-y-auto">
        <div className="px-6 py-4 space-y-3">
          <p className="text-muted-foreground">
            The <span className="text-foreground font-medium">{modelName}</span> model requires an API key for{" "}
            <span className="text-foreground font-medium">{providerName}</span>.
          </p>
          <p className="text-muted-foreground">
            To use this model:
          </p>
          <ol className="text-muted-foreground list-decimal list-inside space-y-2 ml-2">
            <li>
              Go to{" "}
              <span className="text-primary font-medium">
                Settings → API Keys
              </span>{" "}
              and add your {providerName} API key
            </li>
            <li>
              Navigate to the{" "}
              <span className="text-primary font-medium">
                Models
              </span>{" "}
              tab
            </li>
            <li>
              Select <span className="text-foreground font-medium">{modelName}</span> to start chatting
            </li>
          </ol>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="px-0">
          <DrawerHeader className="sr-only">
            <DrawerTitle>API Key Required</DrawerTitle>
          </DrawerHeader>
          {renderContent()}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="[&>button:last-child]:bg-background gap-0 overflow-hidden rounded-3xl p-0 shadow-xs sm:max-w-md [&>button:last-child]:rounded-full [&>button:last-child]:p-1">
        <DialogHeader className="sr-only">
          <DialogTitle>API Key Required</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
