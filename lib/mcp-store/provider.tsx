"use client"

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import { useMCPStore, type MCPStore } from "./store"
import { useUser } from "@/lib/user-store/provider"

const MCPContext = createContext<MCPStore | null>(null)

export function MCPProvider({ children }: { children: ReactNode }) {
  const store = useMCPStore()
  const { user } = useUser()
  const prevUserIdRef = useRef<string | null>(null)
  const hasLoadedRef = useRef(false)

  // Update userId and load servers when user changes
  useEffect(() => {
    const userId = user?.id || null
    
    // Only update if userId actually changed
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId
      store.setUserId(userId)
      store.loadServers()
      hasLoadedRef.current = true
    } else if (!hasLoadedRef.current) {
      // Initial load
      store.loadServers()
      hasLoadedRef.current = true
    }
  }, [user?.id]) // Only depend on user?.id, not store

  return <MCPContext.Provider value={store}>{children}</MCPContext.Provider>
}

export function useMCP() {
  const context = useContext(MCPContext)
  if (!context) {
    throw new Error("useMCP must be used within MCPProvider")
  }
  return context
}
