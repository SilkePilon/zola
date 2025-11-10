import type { MCPServerConfig } from './types'

/**
 * Test connection to an MCP server (client-side wrapper)
 */
export async function testMCPConnection(
  config: MCPServerConfig
): Promise<{ success: boolean; error?: string; toolsCount?: number }> {
  try {
    const response = await fetch('/api/mcp/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.error || 'Failed to test connection',
      }
    }

    const result = await response.json()
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}
