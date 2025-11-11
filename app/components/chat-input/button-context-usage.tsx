import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useModel } from "@/lib/model-store/provider"
import { ChartBar } from "@phosphor-icons/react"
import { useMemo, useState } from "react"

type ButtonContextUsageProps = {
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export function ButtonContextUsage({
  model,
  inputTokens = 0,
  outputTokens = 0,
  totalTokens = 0,
}: ButtonContextUsageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { models } = useModel()
  
  // Find the model info from the loaded models
  const modelInfo = useMemo(() => 
    models.find((m) => m.uniqueId === model),
    [models, model]
  )
  
  // Get contextWindow with fallback
  const contextWindow = modelInfo?.contextWindow ?? 0

  // Calculate usage percentage
  const usagePercentage = contextWindow > 0 ? Math.min((totalTokens / contextWindow) * 100, 100) : 0
  const remainingTokens = Math.max(contextWindow - totalTokens, 0)

  // Format numbers like model selector does (fr-FR for separators)
  const formatContextNumber = (num: number) => {
    return Intl.NumberFormat("fr-FR", { style: "decimal" }).format(num)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="border-border dark:bg-secondary size-9 rounded-[8px] border bg-transparent"
              type="button"
              aria-label="Context usage"
            >
              <ChartBar className="size-4" weight="duotone" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Context usage</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-[200px] p-3"
        align="start"
        side="top"
        sideOffset={4}
      >
        <div className="space-y-3">
          {/* Progress bar - main focus */}
          <div className="space-y-2">
            <Progress
              value={usagePercentage}
              className="h-6 rounded-sm bg-secondary"
              indicatorClassName="bg-foreground/80"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatContextNumber(totalTokens)} / {contextWindow > 0 ? formatContextNumber(contextWindow) : "Unknown"}
              </span>
              <span className="text-muted-foreground">
                {usagePercentage.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Compact stats */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Input</span>
              <span>{formatContextNumber(inputTokens)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">Output</span>
              <span>{formatContextNumber(outputTokens)}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
