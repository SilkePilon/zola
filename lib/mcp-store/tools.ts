import type { MCPServerConfig } from './types'

/**
 * Get tools from enabled MCP servers (client-side wrapper)
 */
export async function getMCPTools(
  servers: MCPServerConfig[]
): Promise<{
  tools: Record<string, any>
  serverCount: number
  toolCount: number
}> {
  try {
    const response = await fetch('/api/mcp/tools', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ servers }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get MCP tools')
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get MCP tools:', error)
    return {
      tools: {},
      serverCount: 0,
      toolCount: 0,
    }
  }
}
