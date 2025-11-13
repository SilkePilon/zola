import { ModelConfig } from "@/lib/models/types"
import { getProviderIcon } from "@/lib/providers"
import ProviderIcon from "@/components/common/provider-icon"
import { Badge } from "@/components/ui/badge"
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
    <div className="bg-popover border-border w-[260px] rounded-md border p-2.5 shadow-lg backdrop-blur-xl">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <ProviderIcon
            providerId={hoveredModelData.icon}
            logoUrl={hoveredModelData.logoUrl}
            className="size-4"
            title={hoveredModelData.provider}
          />
          <h3 className="font-medium text-sm">{hoveredModelData.name}</h3>
        </div>

        {/* API-only: omit description and long-form metadata */}

        {(hoveredModelData.vision || hoveredModelData.tools || hasReasoning || hoveredModelData.webSearch) && (
          <div className="flex flex-wrap gap-1">
            {hoveredModelData.vision && (
              <Badge variant="outline" className="!border-green-300 !bg-green-100 !text-green-700 dark:!border-green-700 dark:!bg-green-900/50 dark:!text-green-300">
                <ImageIcon weight="fill" size={10} className="!text-green-600 dark:!text-green-300" />
                <span>Vision</span>
              </Badge>
            )}

            {hoveredModelData.tools && (
              <Badge variant="outline" className="!border-purple-300 !bg-purple-100 !text-purple-700 dark:!border-purple-700 dark:!bg-purple-900/50 dark:!text-purple-300">
                <WrenchIcon weight="fill" size={10} className="!text-purple-600 dark:!text-purple-300" />
                <span>Tools</span>
              </Badge>
            )}

            {hasReasoning && (
              <Badge variant="outline" className="!border-amber-300 !bg-amber-100 !text-amber-700 dark:!border-amber-700 dark:!bg-amber-900/50 dark:!text-amber-300">
                <BrainIcon weight="fill" size={10} className="!text-amber-600 dark:!text-amber-300" />
                <span>Reasoning</span>
              </Badge>
            )}

            {hoveredModelData.webSearch && (
              <Badge variant="outline" className="!border-blue-300 !bg-blue-100 !text-blue-700 dark:!border-blue-700 dark:!bg-blue-900/50 dark:!text-blue-300">
                <GlobeIcon weight="fill" size={10} className="!text-blue-600 dark:!text-blue-300" />
                <span>Web Search</span>
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
          {hoveredModelData.contextWindow != null && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Context</span>
              <span className="font-mono text-xs">
                {Intl.NumberFormat("fr-FR", {
                  style: "decimal",
                }).format(hoveredModelData.contextWindow)}{" "}
                tokens
              </span>
            </div>
          )}

          {(hoveredModelData.inputCost != null || hoveredModelData.outputCost != null) && (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Input</span>
                {hoveredModelData.inputCost != null && hoveredModelData.inputCost > 0 ? (
                  <span className="font-mono text-xs">
                    {Intl.NumberFormat("ja-JP", {
                      style: "currency",
                      currency: "USD",
                    }).format(hoveredModelData.inputCost)}{" "}
                    / 1M
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Price unknown</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Output</span>
                {hoveredModelData.outputCost != null && hoveredModelData.outputCost > 0 ? (
                  <span className="font-mono text-xs">
                    {Intl.NumberFormat("ja-JP", {
                      style: "currency",
                      currency: "USD",
                    }).format(hoveredModelData.outputCost)}{" "}
                    / 1M
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Price unknown</span>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-border">
            <span className="text-muted-foreground">Provider</span>
            <span className="text-xs">{hoveredModelData.provider}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">ID</span>
            <span className="text-muted-foreground truncate text-xs font-mono bg-accent/50 px-1.5 py-0.5 rounded">
              {String(hoveredModelData.id)}
            </span>
          </div>

          {/* API-only: no external links section */}
        </div>
      </div>
    </div>
  );
}
