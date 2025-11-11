"use client"

import { PopoverContentAuth } from "@/app/components/chat-input/popover-content-auth"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useKeyShortcut } from "@/app/hooks/use-key-shortcut"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useModel } from "@/lib/model-store/provider"
import { filterAndSortModels } from "@/lib/model-store/utils"
import { ModelConfig } from "@/lib/models/types"
import { PROVIDERS } from "@/lib/providers"
import ProviderIcon from "@/components/common/provider-icon"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { cn } from "@/lib/utils"
import {
  CaretDownIcon,
  MagnifyingGlassIcon,
  StarIcon,
} from "@phosphor-icons/react"
import { useRef, useState } from "react"
import { ApiKeyRequiredDialog } from "./api-key-required-dialog"
import { SubMenu } from "./sub-menu"
import { VirtualizedModelList } from "./virtualized-list"
import { VirtualizedModelListMobile } from "./virtualized-list-mobile"

type ModelSelectorProps = {
  selectedModelId: string
  setSelectedModelId: (modelId: string) => void
  className?: string
  isUserAuthenticated?: boolean
}

export function ModelSelector({
  selectedModelId,
  setSelectedModelId,
  className,
  isUserAuthenticated = true,
}: ModelSelectorProps) {
  const { models, isLoading: isLoadingModels, favoriteModels } = useModel()
  const { isModelHidden } = useUserPreferences()

  // Find current model using uniqueId (providerId:modelId format)
  const currentModel = models.find((m) => m.uniqueId === selectedModelId)
    
  const currentProvider = PROVIDERS.find(
    (provider) => provider.id === currentModel?.icon
  )
  const isMobile = useBreakpoint(768)

  const [hoveredModel, setHoveredModel] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isProDialogOpen, setIsProDialogOpen] = useState(false)
  const [selectedProModel, setSelectedProModel] = useState<{
    name: string
    provider: string
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Ref for input to maintain focus
  const searchInputRef = useRef<HTMLInputElement>(null)

  useKeyShortcut(
    (e) => (e.key === "p" || e.key === "P") && e.metaKey && e.shiftKey,
    () => {
      if (isMobile) {
        setIsDrawerOpen((prev) => !prev)
      } else {
        setIsDropdownOpen((prev) => !prev)
      }
    }
  )

  // Get the hovered model data
  const hoveredModelData = models.find((model) => model.uniqueId === hoveredModel)

  const filteredModels = filterAndSortModels(
    models,
    favoriteModels || [],
    searchQuery,
    isModelHidden
  )

  const trigger = (
    <Button
      variant="outline"
      className={cn(className, "dark:bg-secondary justify-between rounded-[8px]")}
      disabled={isLoadingModels}
    >
      <div className="flex items-center gap-2">
        {currentModel ? (
          <ProviderIcon
            providerId={currentModel.icon}
            logoUrl={currentModel.logoUrl}
            className="size-5"
            title={currentModel.provider}
          />
        ) : null}
        <span>{currentModel?.name || "Select model"}</span>
      </div>
      <CaretDownIcon className="size-4 opacity-50" />
    </Button>
  )

  // Handle input change without losing focus
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    setSearchQuery(e.target.value)
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
                className={cn(className, "border-border dark:bg-secondary text-accent-foreground h-9 w-auto border bg-transparent rounded-[8px]")}
                type="button"
              >
                {currentProvider?.icon && (
                  <currentProvider.icon className="size-5" />
                )}
                {currentModel?.name}
                <CaretDownIcon className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Select a model</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    )
  }

  if (isMobile) {
    return (
      <>
        <ApiKeyRequiredDialog
          isOpen={isProDialogOpen}
          setIsOpen={setIsProDialogOpen}
          modelName={selectedProModel?.name || ""}
          providerName={selectedProModel?.provider || ""}
        />
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Select Model</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search models..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="flex h-full flex-col space-y-0 overflow-hidden pb-6">
              {isLoadingModels ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground mb-2 text-sm">
                    Loading models...
                  </p>
                </div>
              ) : filteredModels.length > 0 ? (
                <VirtualizedModelListMobile
                  models={filteredModels}
                  selectedModelId={selectedModelId}
                  onSelectModel={(modelId) => {
                    setSelectedModelId(modelId)
                    setIsDrawerOpen(false)
                  }}
                  onProModelClick={(modelInfo) => {
                    setSelectedProModel(modelInfo)
                    setIsProDialogOpen(true)
                  }}
                  height={400}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground mb-2 text-sm">
                    No results found.
                  </p>
                  <a
                    href="https://github.com/sst/models.dev#contributing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground text-sm underline"
                  >
                    Request a new model
                  </a>
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <div>
      <ApiKeyRequiredDialog
        isOpen={isProDialogOpen}
        setIsOpen={setIsProDialogOpen}
        modelName={selectedProModel?.name || ""}
        providerName={selectedProModel?.provider || ""}
      />
      <Tooltip>
        <DropdownMenu
          open={isDropdownOpen}
          onOpenChange={(open) => {
            setIsDropdownOpen(open)
            if (!open) {
              setHoveredModel(null)
              setSearchQuery("")
            } else {
              if (selectedModelId) setHoveredModel(selectedModelId)
            }
          }}
        >
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Switch model ⌘⇧P</TooltipContent>
          <DropdownMenuContent
            className="flex h-[320px] w-[300px] flex-col space-y-0.5 overflow-visible p-0"
            align="start"
            sideOffset={4}
            forceMount
            side="top"
          >
            <div className="bg-background sticky top-0 z-10 rounded-t-md border-b px-0 pt-0 pb-0">
              <div className="relative">
                <MagnifyingGlassIcon className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search models..."
                  className="dark:bg-popover rounded-b-none border border-none pl-8 shadow-none focus-visible:ring-0"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="flex h-full flex-col space-y-0 overflow-hidden px-0 pt-0 pb-0">
              {isLoadingModels ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground mb-2 text-sm">
                    Loading models...
                  </p>
                </div>
              ) : filteredModels.length > 0 ? (
                <VirtualizedModelList
                  models={filteredModels}
                  selectedModelId={selectedModelId}
                  onSelectModel={(modelId) => {
                    setSelectedModelId(modelId)
                    setIsDropdownOpen(false)
                  }}
                  onHoverModel={(modelId) => {
                    if (isDropdownOpen) {
                      setHoveredModel(modelId)
                    }
                  }}
                  onProModelClick={(modelInfo) => {
                    setSelectedProModel(modelInfo)
                    setIsProDialogOpen(true)
                  }}
                  height={270}
                  isDropdownOpen={isDropdownOpen}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground mb-1 text-sm">
                    No results found.
                  </p>
                  <a
                    href="https://github.com/ibelick/zola/issues/new?title=Model%20Request%3A%20"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground text-sm underline"
                  >
                    Request a new model
                  </a>
                </div>
              )}
            </div>

            {/* Submenu positioned absolutely */}
            {hoveredModelData && (
              <div className="absolute top-0 left-[calc(100%+8px)]">
                <SubMenu hoveredModelData={hoveredModelData} />
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </div>
  )
}
