"use client"

import { ModelConfig } from "@/lib/models/types"
import { List } from "react-window"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import ProviderIcon from "@/components/common/provider-icon"
import { cn } from "@/lib/utils"
import { Check as CheckIcon } from "@phosphor-icons/react"

type VirtualizedMultiModelListProps = {
  models: ModelConfig[]
  selectedModelIds: string[]
  onModelToggle: (modelId: string, isLocked: boolean, modelInfo: { name: string; provider: string }) => void
  onHoverModel: (modelId: string) => void
  height: number
  isDropdownOpen: boolean
}

type CustomRowProps = {
  models: ModelConfig[]
  selectedModelIds: string[]
  onModelToggle: (modelId: string, isLocked: boolean, modelInfo: { name: string; provider: string }) => void
  onHoverModel: (modelId: string) => void
  isDropdownOpen: boolean
}

type RowComponentProps = {
  ariaAttributes: {
    "aria-posinset": number
    "aria-setsize": number
    role: "listitem"
  }
  index: number
  style: React.CSSProperties
} & CustomRowProps

const RowComponent = ({
  index,
  style,
  models,
  selectedModelIds,
  onModelToggle,
  onHoverModel,
  isDropdownOpen,
}: RowComponentProps) => {
  const model = models[index]
  const isLocked = !model.accessible
  const isSelected = selectedModelIds.includes(model.uniqueId)

  return (
    <div style={style}>
      <DropdownMenuItem
        key={model.uniqueId}
        className={cn(
          "flex w-full items-center justify-between gap-2.5 h-8 cursor-pointer py-0",
          isSelected && "bg-accent"
        )}
        onSelect={(e) => {
          e.preventDefault()
          onModelToggle(model.uniqueId, isLocked, {
            name: model.name,
            provider: model.provider,
          })
        }}
        onFocus={() => {
          if (isDropdownOpen) {
            onHoverModel(model.uniqueId)
          }
        }}
        onMouseEnter={() => {
          if (isDropdownOpen) {
            onHoverModel(model.uniqueId)
          }
        }}
      >
        <div className="flex items-center gap-3">
          <ProviderIcon
            providerId={model.icon}
            logoUrl={model.logoUrl}
            className="size-5"
            title={model.provider}
          />
          <div className="flex flex-col gap-0">
            <span className="text-sm">{model.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSelected && <CheckIcon className="size-4" weight="bold" />}
          {isLocked && (
            <div className="border-input bg-accent text-muted-foreground flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
              <span>Unavailable</span>
            </div>
          )}
        </div>
      </DropdownMenuItem>
    </div>
  )
}

export function VirtualizedMultiModelList({
  models,
  selectedModelIds,
  onModelToggle,
  onHoverModel,
  height,
  isDropdownOpen,
}: VirtualizedMultiModelListProps) {
  const ITEM_HEIGHT = 32 // Height of each model item in pixels

  const customRowProps: CustomRowProps = {
    models,
    selectedModelIds,
    onModelToggle,
    onHoverModel,
    isDropdownOpen,
  }

  return (
    <div className="px-1.5 pb-1.5">
      <List<CustomRowProps>
        defaultHeight={height}
        rowComponent={RowComponent}
        rowCount={models.length}
        rowHeight={ITEM_HEIGHT}
        rowProps={customRowProps}
        style={{ height, width: "100%", overflow: "hidden auto" }}
      />
    </div>
  )
}
