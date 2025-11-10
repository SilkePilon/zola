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
      let errorMessage = 'Failed to test connection'
      try {
        const error = await response.json()
        errorMessage = error.error || errorMessage
      } catch {
        // If JSON parsing fails, try to get text or use status
        try {
          const text = await response.text()
          errorMessage = text || `${response.status} ${response.statusText}`
        } catch {
          errorMessage = `${response.status} ${response.statusText}`
        }
      }
      return {
        success: false,
        error: errorMessage,
      }
    }

    try {
      const result = await response.json()
      return result
    } catch {
      return {
        success: false,
        error: 'Invalid JSON response from server',
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}
