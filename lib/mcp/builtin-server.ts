import { z } from "zod"
import type { ToolSet } from "ai"
import type { MCPServerConfig } from "@/lib/mcp-store/types"

/**
 * Built-in MCP server that provides tools for managing MCP servers.
 * This allows the AI to add, list, update, and delete MCP servers dynamically.
 */

// In-memory storage for MCP servers managed by the AI
// In a production environment, this would be persisted to a database
let managedServers: MCPServerConfig[] = []

// Helper to generate unique IDs
function generateId(): string {
  return `builtin-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Creates a built-in MCP server toolset for managing MCP servers
 */
export function createBuiltinMCPTools(): ToolSet {
  return {
    add_mcp_server: {
      description: "Add a new MCP server configuration. This allows the AI to dynamically add new MCP servers that can be used in subsequent interactions.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Name of the MCP server"),
        description: z.string().optional().describe("Description of what this MCP server provides"),
        transportType: z.enum(["http", "sse"]).describe("Transport type: 'http' for HTTP or 'sse' for Server-Sent Events"),
        url: z.string().url().describe("URL of the MCP server endpoint"),
        headers: z.record(z.string(), z.string()).optional().describe("Optional HTTP headers to include in requests (e.g., authorization)"),
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
          const existing = managedServers.find(s => s.name === name)
          if (existing) {
            return {
              success: false,
              error: `MCP server with name "${name}" already exists`,
            }
          }

          const now = new Date().toISOString()
          const newServer: MCPServerConfig = {
            id: generateId(),
            name,
            description,
            transportType,
            url,
            headers: headers || {},
            enabled: enabled ?? true,
            createdAt: now,
            updatedAt: now,
          }

          managedServers.push(newServer)

          return {
            success: true,
            server: newServer,
            message: `Successfully added MCP server "${name}". It will be available for use in subsequent interactions.`,
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
      description: "List all configured MCP servers, including their status and configuration.",
      inputSchema: z.object({
        includeDisabled: z.boolean().default(true).describe("Whether to include disabled servers in the list"),
      }),
      execute: async (args: unknown) => {
        try {
          const typedArgs = args as { includeDisabled?: boolean }
          const { includeDisabled } = typedArgs
          
          let servers = managedServers
          if (!includeDisabled) {
            servers = servers.filter(s => s.enabled)
          }

          return {
            success: true,
            servers: servers.map(s => ({
              id: s.id,
              name: s.name,
              description: s.description,
              enabled: s.enabled,
              transportType: s.transportType,
              url: s.url,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
            })),
            count: servers.length,
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
      description: "Update an existing MCP server configuration. You can update the name, description, URL, headers, or enable/disable status.",
      inputSchema: z.object({
        serverId: z.string().describe("ID of the server to update (use list_mcp_servers to get IDs)"),
        name: z.string().optional().describe("New name for the server"),
        description: z.string().optional().describe("New description"),
        url: z.string().url().optional().describe("New URL"),
        headers: z.record(z.string(), z.string()).optional().describe("New headers (replaces existing)"),
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

          const serverIndex = managedServers.findIndex(s => s.id === serverId)
          if (serverIndex === -1) {
            return {
              success: false,
              error: `MCP server with ID "${serverId}" not found`,
            }
          }

          const server = managedServers[serverIndex]!

          // Check if new name conflicts with another server
          if (name && name !== server.name) {
            const nameConflict = managedServers.find(s => s.name === name && s.id !== serverId)
            if (nameConflict) {
              return {
                success: false,
                error: `Another MCP server with name "${name}" already exists`,
              }
            }
          }

          // Update server
          const updatedServer: MCPServerConfig = {
            ...server,
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(url !== undefined && { url }),
            ...(headers !== undefined && { headers }),
            ...(enabled !== undefined && { enabled }),
            updatedAt: new Date().toISOString(),
          }

          managedServers[serverIndex] = updatedServer

          return {
            success: true,
            server: updatedServer,
            message: `Successfully updated MCP server "${updatedServer.name}"`,
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
      description: "Delete an MCP server configuration. This will remove the server from the list and it will no longer be available.",
      inputSchema: z.object({
        serverId: z.string().describe("ID of the server to delete (use list_mcp_servers to get IDs)"),
      }),
      execute: async (args: unknown) => {
        try {
          const typedArgs = args as { serverId: string }
          const { serverId } = typedArgs

          const serverIndex = managedServers.findIndex(s => s.id === serverId)
          if (serverIndex === -1) {
            return {
              success: false,
              error: `MCP server with ID "${serverId}" not found`,
            }
          }

          const deletedServer = managedServers[serverIndex]!
          managedServers.splice(serverIndex, 1)

          return {
            success: true,
            message: `Successfully deleted MCP server "${deletedServer.name}"`,
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
      description: "Get the current list of MCP servers that can be used. This returns the servers that have been added via the built-in management tools.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return {
            success: true,
            servers: managedServers.filter(s => s.enabled),
            message: `Found ${managedServers.filter(s => s.enabled).length} enabled MCP server(s)`,
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

/**
 * Get the list of managed servers (for integration with buildMcpTools)
 */
export function getManagedServers(): MCPServerConfig[] {
  return managedServers.filter(s => s.enabled)
}

/**
 * Clear all managed servers (useful for testing)
 */
export function clearManagedServers(): void {
  managedServers = []
}
