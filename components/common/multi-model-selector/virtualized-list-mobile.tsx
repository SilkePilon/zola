"use client"

import { ModelConfig } from "@/lib/models/types"
import { List } from "react-window"
import ProviderIcon from "@/components/common/provider-icon"
import { cn } from "@/lib/utils"
import { StarIcon } from "@phosphor-icons/react"
import { Checkbox } from "@/components/ui/checkbox"

type VirtualizedMultiModelListMobileProps = {
  models: ModelConfig[]
  selectedModelIds: string[]
  onModelToggle: (modelId: string, isLocked: boolean, modelInfo: { name: string; provider: string }) => void
  height: number
  isAtLimit: boolean
}

type CustomRowProps = {
  models: ModelConfig[]
  selectedModelIds: string[]
  onModelToggle: (modelId: string, isLocked: boolean, modelInfo: { name: string; provider: string }) => void
  isAtLimit: boolean
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
  isAtLimit,
}: RowComponentProps) => {
  const model = models[index]
  const isLocked = !model.accessible
  const isSelected = selectedModelIds.includes(model.uniqueId)

  return (
    <div
      style={style}
      className={cn(
        "hover:bg-accent/50 flex w-full cursor-pointer items-center justify-between px-3 py-2 overflow-hidden",
        isSelected && "bg-accent"
      )}
      onClick={() =>
        onModelToggle(model.uniqueId, isLocked, {
          name: model.name,
          provider: model.provider,
        })
      }
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={isSelected}
          disabled={isLocked || (!isSelected && isAtLimit)}
          onClick={(e) => e.stopPropagation()}
          onChange={() =>
            onModelToggle(model.uniqueId, isLocked, {
              name: model.name,
              provider: model.provider,
            })
          }
        />
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
        {isLocked && (
          <div className="border-input bg-accent text-muted-foreground flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
            <StarIcon className="size-2" weight="fill" />
            <span>Unavailable</span>
          </div>
        )}
        {!isSelected && isAtLimit && !isLocked && (
          <div className="border-input bg-muted text-muted-foreground flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
            <span>Limit</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function VirtualizedMultiModelListMobile({
  models,
  selectedModelIds,
  onModelToggle,
  height,
  isAtLimit,
}: VirtualizedMultiModelListMobileProps) {
  const ITEM_HEIGHT = 48 // Height of each model item in pixels for mobile

  const customRowProps: CustomRowProps = {
    models,
    selectedModelIds,
    onModelToggle,
    isAtLimit,
  }

  return (
    <List<CustomRowProps>
      defaultHeight={height}
      rowComponent={RowComponent}
      rowCount={models.length}
      rowHeight={ITEM_HEIGHT}
      rowProps={customRowProps}
      style={{ height, width: "100%", overflow: "hidden auto" }}
    />
  )
}
