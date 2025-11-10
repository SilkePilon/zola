import { experimental_createMCPClient } from '@ai-sdk/mcp'
import type { MCPServerConfig } from '@/lib/mcp-store/types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>

async function createMCPClientFromConfig(
  config: MCPServerConfig
): Promise<MCPClient> {
  // Process headers: add Bearer prefix if authBearer is enabled
  let headers = config.headers
  if (config.authBearer && headers?.Authorization) {
    headers = {
      ...headers,
      Authorization: headers.Authorization.startsWith('Bearer ')
        ? headers.Authorization
        : `Bearer ${headers.Authorization}`,
    }
  }

  switch (config.transportType) {
    case 'http': {
      if (!config.url) {
        throw new Error('HTTP transport requires a URL')
      }

      return await experimental_createMCPClient({
        transport: {
          type: 'http',
          url: config.url,
          headers,
        },
      })
    }

    case 'sse': {
      if (!config.url) {
        throw new Error('SSE transport requires a URL')
      }

      return await experimental_createMCPClient({
        transport: {
          type: 'sse',
          url: config.url,
          headers,
        },
      })
    }

    default:
      throw new Error(`Unknown transport type: ${config.transportType}`)
  }
}

/**
 * Get tools from all enabled MCP servers
 * POST /api/mcp/tools
 * Body: { servers: MCPServerConfig[] }
 */
export async function POST(req: Request) {
  try {
    const { servers }: { servers: MCPServerConfig[] } = await req.json()

    if (!Array.isArray(servers)) {
      return NextResponse.json(
        { error: 'Invalid request: servers must be an array' },
        { status: 400 }
      )
    }

    // Filter enabled servers
    const enabledServers = servers.filter((s) => s.enabled)

    if (enabledServers.length === 0) {
      return NextResponse.json({ tools: {}, serverCount: 0, toolCount: 0 })
    }

    // Process each server independently with timeout
    const results = await Promise.allSettled(
      enabledServers.map(async (server) => {
        let client: MCPClient | null = null
        try {
          // Create client with timeout
          const clientPromise = createMCPClientFromConfig(server)
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
          )
          
          client = await Promise.race([clientPromise, timeoutPromise])
          
          // Get tools with timeout
          const toolsPromise = client.tools()
          const toolsTimeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Tools fetch timeout')), 5000)
          )
          
          const tools = await Promise.race([toolsPromise, toolsTimeoutPromise])
          
          return { server: server.name, tools }
        } catch (error) {
          console.error(`Failed to get tools from ${server.name}:`, error)
          return { server: server.name, tools: {}, error: error instanceof Error ? error.message : 'Unknown error' }
        } finally {
          if (client) {
            try {
              await client.close()
            } catch (error) {
              // Ignore close errors
            }
          }
        }
      })
    )

    // Merge successful tool sets
    const allTools: Record<string, any> = {}
    let successCount = 0

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.tools) {
        Object.assign(allTools, result.value.tools)
        if (!result.value.error) {
          successCount++
        }
      }
    })

    return NextResponse.json({
      tools: allTools,
      serverCount: successCount,
      toolCount: Object.keys(allTools).length,
    })
  } catch (error) {
    console.error('Error getting MCP tools:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        tools: {},
        serverCount: 0,
        toolCount: 0,
      },
      { status: 500 }
    )
  }
}
