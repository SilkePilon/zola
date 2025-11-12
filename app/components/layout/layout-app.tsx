"use client"

import { Header } from "@/app/components/layout/header"
import { AppSidebar } from "@/app/components/layout/sidebar/app-sidebar"
import { BudgetWarnings } from "@/app/components/budget/budget-warnings"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useBudget } from "@/lib/budget-store/provider"

export function LayoutApp({ children }: { children: React.ReactNode }) {
  const { preferences } = useUserPreferences()
  const { budgetLimits } = useBudget()
  const hasSidebar = preferences.layout === "sidebar"
  const showBudgetWarnings = 
    Array.isArray(budgetLimits) && 
    budgetLimits.length > 0 && 
    budgetLimits.some((b) => b.in_app_notifications)

  return (
    <div className="bg-background flex h-dvh w-full overflow-hidden">
      {hasSidebar && <AppSidebar />}
      <main className="@container relative h-dvh w-0 flex-shrink flex-grow overflow-y-auto">
        <Header hasSidebar={hasSidebar} />
        {children}
      </main>
      {showBudgetWarnings && <BudgetWarnings />}
    </div>
  )
}
