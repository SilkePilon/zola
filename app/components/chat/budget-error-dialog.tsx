"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { APP_NAME } from "@/lib/config"
import Image from "next/image"

type BudgetErrorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  budgetType: "monthly" | "daily" | "per_chat"
  spent: number
  limit: number
  provider?: string
}

export function BudgetErrorDialog({
  open,
  onOpenChange,
  budgetType,
  spent,
  limit,
  provider,
}: BudgetErrorDialogProps) {
  const budgetTypeLabels = {
    monthly: "Monthly",
    daily: "Daily",
    per_chat: "Per-Chat",
  }

  const budgetLabel = budgetTypeLabels[budgetType] || budgetType

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button:last-child]:bg-background gap-0 overflow-hidden rounded-3xl p-0 shadow-xs sm:max-w-md [&>button:last-child]:rounded-full [&>button:last-child]:p-1">
        <DialogHeader className="p-0">
          <Image
            src="/banner_ocean.jpg"
            alt={`Budget limit notification from ${APP_NAME}`}
            width={400}
            height={128}
            className="h-32 w-full object-cover"
          />
          <DialogTitle className="hidden">Budget Limit Reached</DialogTitle>
          <DialogDescription className="hidden">
            Your budget limit has been exceeded
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Budget Limit Reached</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Budget Limit:</span>
                <span className="font-medium text-foreground">${limit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount Spent:</span>
                <span className="font-medium text-foreground">${spent.toFixed(4)}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              To continue using models from <span className="font-medium text-foreground">{provider || "this provider"}</span>, please adjust your budget limits for <span className="font-medium text-foreground">{provider || "this provider"}</span> in <span className="font-medium text-foreground">Settings → Budget & Limits</span>, or wait for your {budgetLabel.toLowerCase()} budget to reset.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
