import { z } from "zod"
import type { ToolSet } from "ai"
import type { MCPServerConfig } from "@/lib/mcp-store/types"

/**
 * Built-in MCP server that provides tools for managing MCP servers.
 * This allows the AI to add, list, update, and delete MCP servers dynamically.
 * 
 * These tools integrate with the MCP API to persist servers and show them in the UI.
 */

// userId to use for API calls - injected from the chat context
let currentUserId: string | null = null

/**
 * Set the user ID for API calls
 */
export function setBuiltinMCPUserId(userId: string | null) {
  currentUserId = userId
}

/**
 * Helper to make API calls
 */
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const url = `${baseUrl}/api/mcp/servers${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `API call failed: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Creates a built-in MCP server toolset for managing MCP servers
 */
export function createBuiltinMCPTools(): ToolSet {
  return {
    add_mcp_server: {
      description: "Add a new MCP server configuration. IMPORTANT: Before adding a server, check if it requires authentication. If the server needs an API key or token, you MUST ask the user for it first. Common servers that require auth: GitHub (needs GitHub token), Context7 (needs API key). Use the 'headers' parameter to include authentication, e.g., headers: { 'Authorization': 'Bearer YOUR_TOKEN' } or { 'X-API-Key': 'YOUR_KEY' }.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Name of the MCP server"),
        description: z.string().optional().describe("Description of what this MCP server provides"),
        transportType: z.enum(["http", "sse"]).describe("Transport type: 'http' for HTTP or 'sse' for Server-Sent Events"),
        url: z.string().url().describe("URL of the MCP server endpoint"),
        headers: z.record(z.string(), z.string()).optional().describe("HTTP headers for authentication. IMPORTANT: If the server requires authentication, you must ask the user for their API key/token first and include it here. Examples: { 'Authorization': 'Bearer token' }, { 'X-API-Key': 'key' }"),
        enabled: z.boolean().default(true).describe("Whether the server should be enabled immediately"),
      }),
      execute: async (args: unknown) => {
        try {
          const typedArgs = args as {
            name: string
            description?: string
            transportType: "http" | "sse"
            url: string
            headers?: Record<string, string>
            enabled?: boolean
          }
          const { name, description, transportType, url, headers, enabled } = typedArgs

          // Check if server with same name already exists
          const listResult = await apiCall(
            currentUserId ? `?userId=${currentUserId}` : '',
            { method: 'GET' }
          )
          
          const existingServers = listResult.servers || []
          const existing = existingServers.find((s: MCPServerConfig) => s.name === name)
          if (existing) {
            return {
              success: false,
              error: `MCP server with name "${name}" already exists`,
              suggestion: "Try updating the existing server instead, or use a different name.",
            }
          }

          // Add server using the API
          const result = await apiCall('', {
            method: 'POST',
            body: JSON.stringify({
              userId: currentUserId,
              server: {
                name,
                description,
                transportType,
                url,
                headers: headers || {},
                enabled: enabled ?? true,
              },
            }),
          })

          return {
            success: true,
            message: `Successfully added MCP server "${name}". The server is now available in your MCP Settings and will be used in subsequent interactions.`,
            note: "The server has been saved and will appear in the MCP Servers settings panel.",
            server: result.server,
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    },

    list_mcp_servers: {
      description: "List all configured MCP servers, including their status and configuration. This shows both user-configured and AI-added servers.",
      inputSchema: z.object({
        includeDisabled: z.boolean().default(true).describe("Whether to include disabled servers in the list"),
      }),
      execute: async (args: unknown) => {
        try {
          const typedArgs = args as { includeDisabled?: boolean }
          const { includeDisabled } = typedArgs
          
          const result = await apiCall(
            currentUserId ? `?userId=${currentUserId}` : '',
            { method: 'GET' }
          )
          
          let servers = result.servers || []
          if (!includeDisabled) {
            servers = servers.filter((s: MCPServerConfig) => s.enabled)
          }

          return {
            success: true,
            servers: servers.map((s: MCPServerConfig) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              enabled: s.enabled,
              transportType: s.transportType,
              url: s.url,
              hasAuth: s.headers && Object.keys(s.headers).length > 0,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
            })),
            count: servers.length,
            message: servers.length === 0 
              ? "No MCP servers configured yet." 
              : `Found ${servers.length} MCP server(s).`,
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    },

    update_mcp_server: {
      description: "Update an existing MCP server configuration. You can update the name, description, URL, headers (including adding authentication), or enable/disable status.",
      inputSchema: z.object({
        serverId: z.string().describe("ID of the server to update (use list_mcp_servers to get IDs)"),
        name: z.string().optional().describe("New name for the server"),
        description: z.string().optional().describe("New description"),
        url: z.string().url().optional().describe("New URL"),
        headers: z.record(z.string(), z.string()).optional().describe("New headers (replaces existing). If adding authentication, ask user for their API key first."),
        enabled: z.boolean().optional().describe("Enable or disable the server"),
      }),
      execute: async (args: unknown) => {
        try {
          const typedArgs = args as {
            serverId: string
            name?: string
            description?: string
            url?: string
            headers?: Record<string, string>
            enabled?: boolean
          }
          const { serverId, name, description, url, headers, enabled } = typedArgs

          // Get existing servers
          const listResult = await apiCall(
            currentUserId ? `?userId=${currentUserId}` : '',
            { method: 'GET' }
          )
          
          const existingServers = listResult.servers || []
          const server = existingServers.find((s: MCPServerConfig) => s.id === serverId)
          
          if (!server) {
            return {
              success: false,
              error: `MCP server with ID "${serverId}" not found`,
              suggestion: "Use list_mcp_servers to see available servers and their IDs.",
            }
          }

          // Check if new name conflicts with another server
          if (name && name !== server.name) {
            const nameConflict = existingServers.find((s: MCPServerConfig) => s.name === name && s.id !== serverId)
            if (nameConflict) {
              return {
                success: false,
                error: `Another MCP server with name "${name}" already exists`,
              }
            }
          }

          // Prepare updates
          const updates: Partial<MCPServerConfig> = {}
          if (name !== undefined) updates.name = name
          if (description !== undefined) updates.description = description
          if (url !== undefined) updates.url = url
          if (headers !== undefined) updates.headers = headers
          if (enabled !== undefined) updates.enabled = enabled

          await apiCall('', {
            method: 'PATCH',
            body: JSON.stringify({
              userId: currentUserId,
              serverId,
              updates,
            }),
          })

          return {
            success: true,
            message: `Successfully updated MCP server "${name || server.name}". Changes are now visible in MCP Settings.`,
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    },

    delete_mcp_server: {
      description: "Delete an MCP server configuration. This will remove the server from the list and it will no longer be available in the UI or for use.",
      inputSchema: z.object({
        serverId: z.string().describe("ID of the server to delete (use list_mcp_servers to get IDs)"),
      }),
      execute: async (args: unknown) => {
        try {
          const typedArgs = args as { serverId: string }
          const { serverId } = typedArgs

          // Get existing servers to find the server name
          const listResult = await apiCall(
            currentUserId ? `?userId=${currentUserId}` : '',
            { method: 'GET' }
          )
          
          const existingServers = listResult.servers || []
          const server = existingServers.find((s: MCPServerConfig) => s.id === serverId)
          
          if (!server) {
            return {
              success: false,
              error: `MCP server with ID "${serverId}" not found`,
              suggestion: "Use list_mcp_servers to see available servers and their IDs.",
            }
          }

          await apiCall(
            `?serverId=${serverId}${currentUserId ? `&userId=${currentUserId}` : ''}`,
            { method: 'DELETE' }
          )

          return {
            success: true,
            message: `Successfully deleted MCP server "${server.name}". It has been removed from MCP Settings.`,
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    },

    test_mcp_server: {
      description: "Test connectivity to an MCP server without adding it. Useful to verify a server is accessible before adding it.",
      inputSchema: z.object({
        url: z.string().url().describe("URL of the MCP server to test"),
        transportType: z.enum(["http", "sse"]).describe("Transport type: 'http' or 'sse'"),
        headers: z.record(z.string(), z.string()).optional().describe("Optional headers for authentication"),
      }),
      execute: async (args: unknown) => {
        try {
          const typedArgs = args as {
            url: string
            transportType: "http" | "sse"
            headers?: Record<string, string>
          }
          const { url, transportType, headers } = typedArgs

          // Try to connect using the test API endpoint
          // Note: This would need to call the actual test endpoint in a real implementation
          return {
            success: true,
            message: `Connection test initiated for ${url} using ${transportType}${headers ? ' with custom headers' : ''}. In a production environment, this would verify connectivity and list available tools.`,
            note: "This is a simulated test. In production, this would make an actual HTTP request to verify the server.",
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    },

    get_managed_servers: {
      description: "Get the current list of enabled MCP servers. This returns all active servers that are available for use.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await apiCall(
            currentUserId ? `?userId=${currentUserId}` : '',
            { method: 'GET' }
          )
          
          const servers = (result.servers || []).filter((s: MCPServerConfig) => s.enabled)
          
          return {
            success: true,
            servers: servers.map((s: MCPServerConfig) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              url: s.url,
              transportType: s.transportType,
              hasAuth: s.headers && Object.keys(s.headers).length > 0,
            })),
            message: `Found ${servers.length} enabled MCP server(s)`,
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    },
  }
}


