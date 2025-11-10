"use client"

import { create } from "zustand"
import type { MCPServerConfig, MCPServerStatus } from "./types"
import {
  readMCPServers,
  writeMCPServers,
  addMCPServer as addServerToDb,
  updateMCPServer as updateServerInDb,
  deleteMCPServer as deleteServerFromDb,
} from "./persist"
import {
  readMCPServersFromSupabase,
  addMCPServerToSupabase,
  updateMCPServerInSupabase,
  deleteMCPServerFromSupabase,
  clearAllMCPServersInSupabase,
} from "./supabase"

export type MCPStore = {
  servers: MCPServerConfig[]
  statuses: Record<string, MCPServerStatus>
  isLoading: boolean
  userId: string | null
  
  // Actions
  setUserId: (userId: string | null) => void
  loadServers: () => Promise<void>
  addServer: (server: Omit<MCPServerConfig, "id" | "createdAt" | "updatedAt">) => Promise<void>
  updateServer: (id: string, updates: Partial<MCPServerConfig>) => Promise<void>
  deleteServer: (id: string) => Promise<void>
  toggleServer: (id: string) => Promise<void>
  setStatus: (id: string, status: MCPServerStatus) => void
  clearAll: () => Promise<void>
}

export const useMCPStore = create<MCPStore>((set, get) => ({
  servers: [],
  statuses: {},
  isLoading: false,
  userId: null,

  setUserId: (userId) => {
    set({ userId })
  },

  loadServers: async () => {
    set({ isLoading: true })
    try {
      const { userId } = get()
      
      // Use Supabase for authenticated users, IndexedDB for guests
      const servers = userId 
        ? await readMCPServersFromSupabase(userId)
        : await readMCPServers()
      
      set({ servers, isLoading: false })
    } catch (error) {
      console.error("Failed to load MCP servers:", error)
      set({ isLoading: false })
    }
  },

  addServer: async (serverData) => {
    const { userId } = get()

    if (userId) {
      // Use Supabase for authenticated users
      const newServer = await addMCPServerToSupabase(userId, serverData)
      if (!newServer) {
        throw new Error("Failed to add MCP server")
      }
      
      set((state) => ({
        servers: [...state.servers, newServer],
      }))
    } else {
      // Use IndexedDB for guests
      const newServer: MCPServerConfig = {
        ...serverData,
        id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      set((state) => ({
        servers: [...state.servers, newServer],
      }))

      try {
        await addServerToDb(newServer)
      } catch (error) {
        // Rollback on error
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== newServer.id),
        }))
        throw error
      }
    }
  },

  updateServer: async (id, updates) => {
    const prevServers = get().servers
    const { userId } = get()
    
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === id
          ? { ...s, ...updates, updatedAt: new Date().toISOString() }
          : s
      ),
    }))

    try {
      if (userId) {
        await updateMCPServerInSupabase(id, updates)
      } else {
        await updateServerInDb(id, updates)
      }
    } catch (error) {
      // Rollback on error
      set({ servers: prevServers })
      throw error
    }
  },

  deleteServer: async (id) => {
    const prevServers = get().servers
    const { userId } = get()
    
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
      statuses: Object.fromEntries(
        Object.entries(state.statuses).filter(([key]) => key !== id)
      ),
    }))

    try {
      if (userId) {
        await deleteMCPServerFromSupabase(id)
      } else {
        await deleteServerFromDb(id)
      }
    } catch (error) {
      // Rollback on error
      set({ servers: prevServers })
      throw error
    }
  },

  toggleServer: async (id) => {
    const server = get().servers.find((s) => s.id === id)
    if (!server) return

    await get().updateServer(id, { enabled: !server.enabled })
  },

  setStatus: (id, status) => {
    set((state) => ({
      statuses: {
        ...state.statuses,
        [id]: status,
      },
    }))
  },

  clearAll: async () => {
    const { userId } = get()
    set({ servers: [], statuses: {} })
    
    if (userId) {
      await clearAllMCPServersInSupabase(userId)
    } else {
      await writeMCPServers([])
    }
  },
}))
