export type BudgetLimits = {
  id: string
  user_id: string
  provider_id: string | null
  monthly_budget_usd: number | null
  daily_budget_usd: number | null
  per_chat_budget_usd: number | null
  current_month_spend: number
  current_day_spend: number
  month_reset: string
  day_reset: string
  warning_threshold_percent: number
  email_notifications: boolean
  in_app_notifications: boolean
  enforce_limits: boolean
  created_at: string
  updated_at: string
}

export type BudgetStatus = {
  spent: number
  limit: number | null
  percentage: number
  isWarning: boolean
  isExceeded: boolean
}

export type BudgetAlert = {
  id: string
  user_id: string
  alert_type: "warning" | "limit_reached" | "budget_exceeded"
  budget_type: "monthly" | "daily" | "per_chat"
  threshold_percent: number | null
  amount_spent: number | null
  budget_limit: number | null
  message: string | null
  acknowledged: boolean
  created_at: string
}
