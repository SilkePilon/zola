import { fetchClient } from "@/lib/fetch"
import type { MCPServerConfig } from "./types"

/**
 * Server-backed persistence for MCP servers (via app/api/mcp-servers),
 * used instead of IndexedDB for authenticated users.
 */

export async function readMCPServersFromSupabase(
  userId: string
): Promise<MCPServerConfig[]> {
  if (!userId) return []
  try {
    const res = await fetchClient("/api/mcp-servers")
    if (!res.ok) return []
    const { servers } = await res.json()
    return servers
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
    const res = await fetchClient("/api/mcp-servers", {
      method: "POST",
      body: JSON.stringify(server),
    })
    if (!res.ok) return null
    const { server: created } = await res.json()
    return created
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
    const res = await fetchClient(`/api/mcp-servers/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
    return res.ok
  } catch (error) {
    console.error("Error updating MCP server:", error)
    return false
  }
}

export async function deleteMCPServerFromSupabase(
  id: string
): Promise<boolean> {
  try {
    const res = await fetchClient(`/api/mcp-servers/${id}`, {
      method: "DELETE",
    })
    return res.ok
  } catch (error) {
    console.error("Error deleting MCP server:", error)
    return false
  }
}

export async function clearAllMCPServersInSupabase(
  userId: string
): Promise<boolean> {
  try {
    const res = await fetchClient("/api/mcp-servers", { method: "DELETE" })
    return res.ok
  } catch (error) {
    console.error("Error clearing MCP servers:", error)
    return false
  }
}
