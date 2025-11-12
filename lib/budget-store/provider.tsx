"use client"

import { createContext, ReactNode, useContext, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchClient } from "@/lib/fetch"
import type { BudgetLimits, BudgetStatus, BudgetAlert } from "./types"

export { type BudgetLimits, type BudgetStatus, type BudgetAlert }

type BudgetStatusResponse = {
  hasBudget: boolean
  budgetLimits: BudgetLimits | null
  status: {
    monthly: BudgetStatus
    daily: BudgetStatus
  } | null
}

interface BudgetContextType {
  budgetLimits: BudgetLimits[] | null
  budgetStatus: BudgetStatusResponse | null
  isLoading: boolean
  saveBudgetLimits: (limits: any) => Promise<void>
  deleteBudgetLimits: () => Promise<void>
  refetchBudgetStatus: () => Promise<void>
  isSaving: boolean
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined)

async function fetchBudgetLimits(): Promise<BudgetLimits[]> {
  const response = await fetchClient("/api/budget-limits")
  if (!response.ok) {
    throw new Error("Failed to fetch budget limits")
  }
  const data = await response.json()
  return data.budgetLimits || []
}

async function fetchBudgetStatus(): Promise<BudgetStatusResponse> {
  const response = await fetchClient("/api/budget-status")
  if (!response.ok) {
    throw new Error("Failed to fetch budget status")
  }
  return response.json()
}

async function saveBudgetLimitsApi(
  limits: Partial<BudgetLimits>
): Promise<BudgetLimits> {
  const response = await fetchClient("/api/budget-limits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(limits),
  })

  if (!response.ok) {
    throw new Error("Failed to save budget limits")
  }

  const data = await response.json()
  return data.budgetLimits
}

async function deleteBudgetLimitsApi(): Promise<void> {
  const response = await fetchClient("/api/budget-limits", {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error("Failed to delete budget limits")
  }
}

export function BudgetProvider({
  children,
  userId,
}: {
  children: ReactNode
  userId?: string
}) {
  const isAuthenticated = !!userId
  const queryClient = useQueryClient()

  // Query for budget limits
  const {
    data: budgetLimits = null,
    isLoading: isLoadingLimits,
  } = useQuery<BudgetLimits[]>({
    queryKey: ["budget-limits", userId],
    queryFn: fetchBudgetLimits,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Query for budget status
  const {
    data: budgetStatus = null,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery<BudgetStatusResponse>({
    queryKey: ["budget-status", userId],
    queryFn: fetchBudgetStatus,
    enabled: isAuthenticated,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  })

  // Mutation for saving budget limits
  const saveMutation = useMutation({
    mutationFn: saveBudgetLimitsApi,
    onSuccess: (data) => {
      queryClient.setQueryData(["budget-limits", userId], data)
      queryClient.invalidateQueries({ queryKey: ["budget-status", userId] })
    },
  })

  // Mutation for deleting budget limits
  const deleteMutation = useMutation({
    mutationFn: deleteBudgetLimitsApi,
    onSuccess: () => {
      queryClient.setQueryData(["budget-limits", userId], null)
      queryClient.invalidateQueries({ queryKey: ["budget-status", userId] })
    },
  })

  const saveBudgetLimits = useCallback(
    async (limits: Partial<BudgetLimits>) => {
      await saveMutation.mutateAsync(limits)
    },
    [saveMutation]
  )

  const deleteBudgetLimits = useCallback(async () => {
    await deleteMutation.mutateAsync()
  }, [deleteMutation])

  const refetchBudgetStatus = useCallback(async () => {
    await refetchStatus()
  }, [refetchStatus])

  const isLoading = isLoadingLimits || isLoadingStatus
  const isSaving = saveMutation.isPending || deleteMutation.isPending

  return (
    <BudgetContext.Provider
      value={{
        budgetLimits,
        budgetStatus,
        isLoading,
        saveBudgetLimits,
        deleteBudgetLimits,
        refetchBudgetStatus,
        isSaving,
      }}
    >
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudget() {
  const context = useContext(BudgetContext)
  if (context === undefined) {
    throw new Error("useBudget must be used within a BudgetProvider")
  }
  return context
}
