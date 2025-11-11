"use client"

import { ModelConfig } from "@/lib/models/types"
import { List } from "react-window"
import ProviderIcon from "@/components/common/provider-icon"
import { cn } from "@/lib/utils"
import { StarIcon } from "@phosphor-icons/react"

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

  return (
    <div
      style={style}
      className={cn(
        "flex w-full items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent overflow-hidden",
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
          <StarIcon className="size-2" />
          <span>Unavailable</span>
        </div>
      )}
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
  const ITEM_HEIGHT = 48 // Height of each model item in pixels for mobile

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
