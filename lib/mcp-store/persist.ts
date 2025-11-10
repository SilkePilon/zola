import { get, set, del, keys } from "idb-keyval"
import type { MCPServerConfig } from "./types"

const MCP_STORE_KEY = "mcp-servers"

export async function readMCPServers(): Promise<MCPServerConfig[]> {
  if (typeof window === "undefined") return []
  
  try {
    const servers = await get<MCPServerConfig[]>(MCP_STORE_KEY)
    return servers || []
  } catch (error) {
    console.warn("Failed to read MCP servers from IndexedDB:", error)
    return []
  }
}

export async function writeMCPServers(servers: MCPServerConfig[]): Promise<void> {
  if (typeof window === "undefined") return
  
  try {
    await set(MCP_STORE_KEY, servers)
  } catch (error) {
    console.error("Failed to write MCP servers to IndexedDB:", error)
    throw error
  }
}

export async function addMCPServer(server: MCPServerConfig): Promise<void> {
  const servers = await readMCPServers()
  servers.push(server)
  await writeMCPServers(servers)
}

export async function updateMCPServer(id: string, updates: Partial<MCPServerConfig>): Promise<void> {
  const servers = await readMCPServers()
  const index = servers.findIndex(s => s.id === id)
  
  if (index === -1) {
    throw new Error(`MCP server with id ${id} not found`)
  }
  
  servers[index] = {
    ...servers[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  
  await writeMCPServers(servers)
}

export async function deleteMCPServer(id: string): Promise<void> {
  const servers = await readMCPServers()
  const filtered = servers.filter(s => s.id !== id)
  await writeMCPServers(filtered)
}

export async function clearAllMCPServers(): Promise<void> {
  if (typeof window === "undefined") return
  
  await del(MCP_STORE_KEY)
}
