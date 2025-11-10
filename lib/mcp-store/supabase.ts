import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/app/types/database.types"
import type { MCPServerConfig } from "./types"

type MCPServerRow = Database["public"]["Tables"]["mcp_servers"]["Row"]
type MCPServerInsert = Database["public"]["Tables"]["mcp_servers"]["Insert"]
type MCPServerUpdate = Database["public"]["Tables"]["mcp_servers"]["Update"]

/**
 * Supabase-based persistence for MCP servers.
 * Stores servers in the database instead of IndexedDB.
 */

export async function readMCPServersFromSupabase(userId: string): Promise<MCPServerConfig[]> {
  try {
    const supabase = createClient()
    if (!supabase) return []
    
    const { data, error } = await supabase
      .from("mcp_servers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Failed to read MCP servers from Supabase:", error)
      return []
    }

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      enabled: row.enabled ?? false,
      transportType: row.transport_type as "http" | "sse",
      url: row.url || undefined,
      headers: row.headers as Record<string, string> | undefined,
      icon: row.icon || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
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
    
    const insertData: MCPServerInsert = {
      user_id: userId,
      name: server.name,
      description: server.description || null,
      enabled: server.enabled,
      transport_type: server.transportType,
      url: server.url || null,
      headers: (server.headers as any) || null,
      icon: server.icon || null,
    }
    
    const { data, error } = await supabase
      .from("mcp_servers")
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error("Failed to add MCP server:", error)
      return null
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      enabled: data.enabled ?? false,
      transportType: data.transport_type as "http" | "sse",
      url: data.url || undefined,
      headers: data.headers as Record<string, string> | undefined,
      icon: data.icon || undefined,
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
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
    
    const updateData: MCPServerUpdate = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description || null
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled
    if (updates.transportType !== undefined) updateData.transport_type = updates.transportType
    if (updates.url !== undefined) updateData.url = updates.url || null
    if (updates.headers !== undefined) updateData.headers = (updates.headers as any) || null
    if (updates.icon !== undefined) updateData.icon = updates.icon || null

    const { error } = await supabase
      .from("mcp_servers")
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
      .from("mcp_servers")
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
      .from("mcp_servers")
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
