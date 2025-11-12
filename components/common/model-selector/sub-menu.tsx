import { ModelConfig } from "@/lib/models/types"
import { getProviderIcon } from "@/lib/providers"
import ProviderIcon from "@/components/common/provider-icon"
import { BrainIcon, GlobeIcon, ImageIcon, WrenchIcon } from "@phosphor-icons/react"

type SubMenuProps = {
  hoveredModelData: ModelConfig
}

export function SubMenu({ hoveredModelData }: SubMenuProps) {
  const providerIcon = hoveredModelData.icon ? getProviderIcon(hoveredModelData.icon) : undefined
  const hasReasoning = Boolean(
    (hoveredModelData as any).reasoning ?? hoveredModelData.reasoningText
  )

  return (
    <div className="bg-popover border-border w-[280px] rounded-md border p-3 shadow-md">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <ProviderIcon
            providerId={hoveredModelData.icon}
            logoUrl={hoveredModelData.logoUrl}
            className="size-5"
            title={hoveredModelData.provider}
          />
          <h3 className="font-medium">{hoveredModelData.name}</h3>
        </div>

        {/* API-only: omit description and long-form metadata */}

        <div className="flex flex-col gap-1">
          <div className="mt-1 flex flex-wrap gap-2">
            {hoveredModelData.vision && (
              <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-800 dark:text-green-100">
                <ImageIcon className="size-3" />
                <span>Vision</span>
              </div>
            )}

            {hoveredModelData.tools && (
              <div className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-800 dark:text-purple-100">
                <WrenchIcon className="size-3" />
                <span>Tools</span>
              </div>
            )}

            {hasReasoning && (
              <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-800 dark:text-amber-100">
                <BrainIcon className="size-3" />
                <span>Reasoning</span>
              </div>
            )}

            {hoveredModelData.webSearch && (
              <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-800 dark:text-blue-100">
                <GlobeIcon className="size-3" />
                <span>Web Search</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {hoveredModelData.contextWindow != null && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">Context</span>
              <span>
                {Intl.NumberFormat("fr-FR", {
                  style: "decimal",
                }).format(hoveredModelData.contextWindow)}{" "}
                tokens
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {hoveredModelData.inputCost != null && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">Input Pricing</span>
                <span>
                  {Intl.NumberFormat("ja-JP", {
                    style: "currency",
                    currency: "USD",
                  }).format(hoveredModelData.inputCost)}{" "}
                  / 1M tokens
                </span>
              </div>
            )}

            {hoveredModelData.outputCost != null && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">Output Pricing</span>
                <span>
                  {Intl.NumberFormat("ja-JP", {
                    style: "currency",
                    currency: "USD",
                  }).format(hoveredModelData.outputCost)}{" "}
                  / 1M tokens
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Provider</span>
            <span>{hoveredModelData.provider}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex-1 font-medium">Id</span>
            <span className="text-muted-foreground truncate text-xs">
              {String(hoveredModelData.id)}
            </span>
          </div>

          {/* API-only: no external links section */}
        </div>
      </div>
    </div>
  );
}
