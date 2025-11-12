"use client"

import * as React from "react"
import { useBudget } from "@/lib/budget-store/provider"
import { useBudgetAlerts } from "@/lib/budget-store/use-budget-alerts"
import { useUser } from "@/lib/user-store/provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, X, DollarSign } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

export function BudgetWarnings() {
  const { user } = useUser()
  const { budgetStatus } = useBudget()
  const { alerts, acknowledgeAlerts } = useBudgetAlerts(user?.id, true)
  const [dismissedAlerts, setDismissedAlerts] = React.useState<Set<string>>(
    new Set()
  )

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(
    (alert) => !dismissedAlerts.has(alert.id)
  )

  const handleDismiss = async (alertId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertId))
    try {
      await acknowledgeAlerts([alertId])
    } catch (error) {
      console.error("Failed to acknowledge alert:", error)
    }
  }

  const handleDismissAll = async () => {
    const alertIds = visibleAlerts.map((alert) => alert.id)
    setDismissedAlerts((prev) => {
      const newSet = new Set(prev)
      alertIds.forEach((id) => newSet.add(id))
      return newSet
    })
    try {
      await acknowledgeAlerts(alertIds)
    } catch (error) {
      console.error("Failed to acknowledge alerts:", error)
    }
  }

  // Show budget status warnings if near limits
  const showMonthlyWarning =
    budgetStatus?.status?.monthly?.isWarning ||
    budgetStatus?.status?.monthly?.isExceeded
  const showDailyWarning =
    budgetStatus?.status?.daily?.isWarning ||
    budgetStatus?.status?.daily?.isExceeded

  if (visibleAlerts.length === 0 && !showMonthlyWarning && !showDailyWarning) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-2">
      <AnimatePresence mode="popLayout">
        {/* Budget Status Warnings */}
        {showMonthlyWarning && budgetStatus?.status?.monthly && (
          <motion.div
            key="monthly-warning"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Alert
              className={
                budgetStatus.status.monthly.isExceeded
                  ? "border-destructive"
                  : "border-warning"
              }
            >
              <AlertTriangle className="size-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>
                  Monthly Budget{" "}
                  {budgetStatus.status.monthly.isExceeded
                    ? "Exceeded"
                    : "Warning"}
                </span>
              </AlertTitle>
              <AlertDescription className="text-xs">
                <div className="mt-1 flex items-baseline gap-1">
                  <DollarSign className="size-3" />
                  <span className="font-semibold">
                    {budgetStatus.status.monthly.spent.toFixed(4)}
                  </span>
                  <span className="text-muted-foreground">
                    of ${budgetStatus.status.monthly.limit?.toFixed(2)} (
                    {budgetStatus.status.monthly.percentage.toFixed(1)}%)
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {showDailyWarning && budgetStatus?.status?.daily && (
          <motion.div
            key="daily-warning"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Alert
              className={
                budgetStatus.status.daily.isExceeded
                  ? "border-destructive"
                  : "border-warning"
              }
            >
              <AlertTriangle className="size-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>
                  Daily Budget{" "}
                  {budgetStatus.status.daily.isExceeded
                    ? "Exceeded"
                    : "Warning"}
                </span>
              </AlertTitle>
              <AlertDescription className="text-xs">
                <div className="mt-1 flex items-baseline gap-1">
                  <DollarSign className="size-3" />
                  <span className="font-semibold">
                    {budgetStatus.status.daily.spent.toFixed(4)}
                  </span>
                  <span className="text-muted-foreground">
                    of ${budgetStatus.status.daily.limit?.toFixed(2)} (
                    {budgetStatus.status.daily.percentage.toFixed(1)}%)
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Historical Alerts */}
        {visibleAlerts.slice(0, 3).map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Alert className="relative">
              <AlertTriangle className="size-4" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 size-6"
                onClick={() => handleDismiss(alert.id)}
              >
                <X className="size-3" />
              </Button>
              <AlertTitle className="pr-8 text-sm">
                {getAlertTitle(alert.alert_type, alert.budget_type)}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {alert.message}
              </AlertDescription>
            </Alert>
          </motion.div>
        ))}

        {visibleAlerts.length > 3 && (
          <motion.div
            key="dismiss-all"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismissAll}
              className="w-full"
            >
              Dismiss All ({visibleAlerts.length})
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function getAlertTitle(
  alertType: string,
  budgetType: string
): string {
  const budgetLabel =
    budgetType === "monthly"
      ? "Monthly"
      : budgetType === "daily"
        ? "Daily"
        : "Per-Chat"

  if (alertType === "limit_reached") {
    return `${budgetLabel} Budget Limit Reached`
  }
  if (alertType === "budget_exceeded") {
    return `${budgetLabel} Budget Exceeded`
  }
  return `${budgetLabel} Budget Warning`
}
