"use client"

import { ModelConfig } from "@/lib/models/types"
import { List } from "react-window"
import ProviderIcon from "@/components/common/provider-icon"
import { Badge } from "@/components/ui/badge"
import { BrainIcon, ImageIcon, WrenchIcon, StarIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

type VirtualizedModelListMobileProps = {
  models: ModelConfig[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  onProModelClick: (modelInfo: { name: string; provider: string }) => void
  height: number
}

type CustomRowProps = {
  models: ModelConfig[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  onProModelClick: (modelInfo: { name: string; provider: string }) => void
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
  onProModelClick,
}: RowComponentProps) => {
  const model = models[index]
  const isLocked = !model.accessible
  const hasReasoning = Boolean(model.reasoning ?? model.reasoningText)

  return (
    <div
      style={style}
      className={cn(
        "flex w-full items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-accent overflow-hidden transition-colors",
        selectedModelId === model.uniqueId && "bg-accent"
      )}
      onClick={() => {
        if (isLocked) {
          onProModelClick({ name: model.name, provider: model.provider })
          return
        }
        onSelectModel(model.uniqueId)
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ProviderIcon
          providerId={model.icon}
          logoUrl={model.logoUrl}
          className="size-5 shrink-0"
          title={model.provider}
        />
        <div className="flex flex-col gap-0 min-w-0">
          <span className="text-sm truncate">{model.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Capability badges */}
        <div className="flex items-center gap-1">
          {model.vision && (
            <Badge variant="outline" className="h-5 w-5 p-0 !border-green-300 !bg-green-100 !text-green-600 dark:!border-green-700 dark:!bg-green-900/50 dark:!text-green-300 [&>svg]:!size-3 [&>svg]:!text-green-600 dark:[&>svg]:!text-green-300">
              <ImageIcon weight="fill" />
            </Badge>
          )}
          {model.tools && (
            <Badge variant="outline" className="h-5 w-5 p-0 !border-purple-300 !bg-purple-100 !text-purple-600 dark:!border-purple-700 dark:!bg-purple-900/50 dark:!text-purple-300 [&>svg]:!size-3 [&>svg]:!text-purple-600 dark:[&>svg]:!text-purple-300">
              <WrenchIcon weight="fill" />
            </Badge>
          )}
          {hasReasoning && (
            <Badge variant="outline" className="h-5 w-5 p-0 !border-amber-300 !bg-amber-100 !text-amber-600 dark:!border-amber-700 dark:!bg-amber-900/50 dark:!text-amber-300 [&>svg]:!size-3 [&>svg]:!text-amber-600 dark:[&>svg]:!text-amber-300">
              <BrainIcon weight="fill" />
            </Badge>
          )}
        </div>
        {isLocked && (
          <div className="border-input bg-accent text-muted-foreground flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
            <span>Unavailable</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function VirtualizedModelListMobile({
  models,
  selectedModelId,
  onSelectModel,
  onProModelClick,
  height,
}: VirtualizedModelListMobileProps) {
  const ITEM_HEIGHT = 52 // Height of each model item in pixels for mobile

  const customRowProps: CustomRowProps = {
    models,
    selectedModelId,
    onSelectModel,
    onProModelClick,
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
