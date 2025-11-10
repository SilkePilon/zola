import { experimental_createMCPClient } from '@ai-sdk/mcp'
import type { MCPServerConfig } from '@/lib/mcp-store/types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>

async function createMCPClientFromConfig(
  config: MCPServerConfig
): Promise<MCPClient> {
  if (!config.enabled) {
    throw new Error(`MCP server "${config.name}" is disabled`)
  }

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

export async function POST(req: Request) {
  let client: MCPClient | null = null

  try {
    const config: MCPServerConfig = await req.json()

    // Validate required fields
    if (!config.name) {
      return NextResponse.json(
        { success: false, error: 'Server name is required' },
        { status: 400 }
      )
    }

    if ((config.transportType === 'http' || config.transportType === 'sse') && !config.url) {
      return NextResponse.json(
        { success: false, error: 'URL is required for HTTP/SSE transport' },
        { status: 400 }
      )
    }

    // Create client and test connection
    client = await createMCPClientFromConfig(config)
    
    // Get available tools
    const tools = await client.tools()
    const toolsCount = Object.keys(tools).length

    return NextResponse.json({
      success: true,
      toolsCount,
    })
  } catch (error) {
    console.error('MCP test connection error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  } finally {
    if (client) {
      try {
        await client.close()
      } catch (error) {
        console.error('Error closing MCP client:', error)
      }
    }
  }
}
