import { createClient } from "@/lib/supabase/client"
import type { MCPServerConfig } from "./types"

/**
 * Supabase-based persistence for MCP servers.
 * Stores servers in the database instead of IndexedDB.
 */

export async function readMCPServersFromSupabase(userId: string): Promise<MCPServerConfig[]> {
  try {
    const supabase = createClient()
    if (!supabase) return []
    
    const { data, error } = await supabase
      .from("mcp_servers" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Failed to read MCP servers from Supabase:", error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      enabled: row.enabled,
      transportType: row.transport_type,
      command: row.command || undefined,
      args: row.args || undefined,
      env: row.env || undefined,
      url: row.url || undefined,
      headers: row.headers || undefined,
      icon: row.icon || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  } catch (error) {
    console.error("Error reading MCP servers:", error)
    return []
  }
}

export async function addMCPServerToSupabase(
  userId: string,
  server: Omit<MCPServerConfig, "id" | "createdAt" | "updatedAt">
): Promise<MCPServerConfig | null> {
  try {
    const supabase = createClient()
    if (!supabase) return null
    
    const { data, error } = await supabase
      .from("mcp_servers" as any)
      .insert({
        user_id: userId,
        name: server.name,
        description: server.description || null,
        enabled: server.enabled,
        transport_type: server.transportType,
        url: server.url || null,
        headers: server.headers || null,
        icon: server.icon || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Failed to add MCP server:", error)
      return null
    }

    const row = data as any
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      enabled: row.enabled,
      transportType: row.transport_type,
      url: row.url || undefined,
      headers: row.headers || undefined,
      icon: row.icon || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }
  } catch (error) {
    console.error("Error adding MCP server:", error)
    return null
  }
}

export async function updateMCPServerInSupabase(
  id: string,
  updates: Partial<Omit<MCPServerConfig, "id" | "createdAt" | "updatedAt">>
): Promise<boolean> {
  try {
    const supabase = createClient()
    if (!supabase) return false
    
    const updateData: any = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description || null
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled
    if (updates.transportType !== undefined) updateData.transport_type = updates.transportType
    if (updates.url !== undefined) updateData.url = updates.url || null
    if (updates.headers !== undefined) updateData.headers = updates.headers || null
    if (updates.icon !== undefined) updateData.icon = updates.icon || null

    const { error } = await supabase
      .from("mcp_servers" as any)
      .update(updateData)
      .eq("id", id)

    if (error) {
      console.error("Failed to update MCP server:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error updating MCP server:", error)
    return false
  }
}

export async function deleteMCPServerFromSupabase(id: string): Promise<boolean> {
  try {
    const supabase = createClient()
    if (!supabase) return false
    
    const { error } = await supabase
      .from("mcp_servers" as any)
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Failed to delete MCP server:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error deleting MCP server:", error)
    return false
  }
}

export async function clearAllMCPServersInSupabase(userId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    if (!supabase) return false
    
    const { error } = await supabase
      .from("mcp_servers" as any)
      .delete()
      .eq("user_id", userId)

    if (error) {
      console.error("Failed to clear MCP servers:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error clearing MCP servers:", error)
    return false
  }
}
