"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchClient } from "@/lib/fetch"
import type { BudgetAlert } from "./types"

export function useBudgetAlerts(userId?: string, unacknowledgedOnly = false) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["budget-alerts", userId, unacknowledgedOnly],
    queryFn: async () => {
      const url = unacknowledgedOnly
        ? "/api/budget-alerts?unacknowledged=true"
        : "/api/budget-alerts"
      const response = await fetchClient(url)
      if (!response.ok) {
        throw new Error("Failed to fetch budget alerts")
      }
      return response.json()
    },
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: unacknowledgedOnly ? 1000 * 60 * 2 : undefined, // Poll every 2 minutes for unacknowledged
  })

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertIds: string[]) => {
      const response = await fetchClient("/api/budget-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alertIds }),
      })

      if (!response.ok) {
        throw new Error("Failed to acknowledge alerts")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-alerts"] })
    },
  })

  return {
    alerts: (data?.alerts as BudgetAlert[]) || [],
    total: data?.total || 0,
    isLoading,
    error,
    acknowledgeAlerts: acknowledgeMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
  }
}
