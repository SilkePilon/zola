"use client"

import { ModelConfig } from "@/lib/models/types"
import { List } from "react-window"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import ProviderIcon from "@/components/common/provider-icon"
import { cn } from "@/lib/utils"

type VirtualizedModelListProps = {
  models: ModelConfig[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  onHoverModel: (modelId: string) => void
  onProModelClick: (modelInfo: { name: string; provider: string }) => void
  height: number
  isDropdownOpen: boolean
}

type CustomRowProps = {
  models: ModelConfig[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  onHoverModel: (modelId: string) => void
  onProModelClick: (modelInfo: { name: string; provider: string }) => void
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
  selectedModelId,
  onSelectModel,
  onHoverModel,
  onProModelClick,
  isDropdownOpen,
}: RowComponentProps) => {
  const model = models[index]
  const isLocked = !model.accessible

  return (
    <div style={style}>
      <DropdownMenuItem
        key={model.uniqueId}
        className={cn(
          "flex w-full items-center justify-between gap-2.5 h-8 cursor-pointer py-0",
          selectedModelId === model.uniqueId && "bg-accent"
        )}
        onSelect={() => {
          if (isLocked) {
            onProModelClick({ name: model.name, provider: model.provider })
            return
          }
          onSelectModel(model.uniqueId)
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
        {isLocked && (
          <div className="border-input bg-accent text-muted-foreground flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
            <span>Unavailable</span>
          </div>
        )}
      </DropdownMenuItem>
    </div>
  )
}

export function VirtualizedModelList({
  models,
  selectedModelId,
  onSelectModel,
  onHoverModel,
  onProModelClick,
  height,
  isDropdownOpen,
}: VirtualizedModelListProps) {
  const ITEM_HEIGHT = 32 // Height of each model item in pixels

  const customRowProps: CustomRowProps = {
    models,
    selectedModelId,
    onSelectModel,
    onHoverModel,
    onProModelClick,
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
