import { NextResponse } from 'next/server'
import type { MCPServerConfig } from '@/lib/mcp-store/types'
import {
  readMCPServersFromSupabase,
  addMCPServerToSupabase,
  updateMCPServerInSupabase,
  deleteMCPServerFromSupabase,
} from '@/lib/mcp-store/supabase'
import {
  readMCPServers,
  addMCPServer as addServerToDb,
  updateMCPServer as updateServerInDb,
  deleteMCPServer as deleteServerFromDb,
} from '@/lib/mcp-store/persist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - List all MCP servers
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    let servers: MCPServerConfig[]
    
    if (userId) {
      servers = await readMCPServersFromSupabase(userId)
    } else {
      servers = await readMCPServers()
    }

    return NextResponse.json({
      success: true,
      servers,
      count: servers.length,
    })
  } catch (error) {
    console.error('Error listing MCP servers:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST - Add a new MCP server
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, server } = body as {
      userId?: string
      server: Omit<MCPServerConfig, 'id' | 'createdAt' | 'updatedAt'>
    }

    if (!server || !server.name || !server.url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server name and URL are required',
        },
        { status: 400 }
      )
    }

    let newServer: MCPServerConfig

    if (userId) {
      const result = await addMCPServerToSupabase(userId, server)
      if (!result) {
        throw new Error('Failed to add server to database')
      }
      newServer = result
    } else {
      newServer = {
        ...server,
        id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await addServerToDb(newServer)
    }

    return NextResponse.json({
      success: true,
      server: newServer,
      message: `Successfully added MCP server "${server.name}"`,
    })
  } catch (error) {
    console.error('Error adding MCP server:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// PATCH - Update an existing MCP server
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { userId, serverId, updates } = body as {
      userId?: string
      serverId: string
      updates: Partial<MCPServerConfig>
    }

    if (!serverId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server ID is required',
        },
        { status: 400 }
      )
    }

    if (userId) {
      const success = await updateMCPServerInSupabase(serverId, updates)
      if (!success) {
        throw new Error('Failed to update server in database')
      }
    } else {
      await updateServerInDb(serverId, updates)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated MCP server`,
    })
  } catch (error) {
    console.error('Error updating MCP server:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// DELETE - Remove an MCP server
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const serverId = searchParams.get('serverId')

    if (!serverId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server ID is required',
        },
        { status: 400 }
      )
    }

    if (userId) {
      const success = await deleteMCPServerFromSupabase(serverId)
      if (!success) {
        throw new Error('Failed to delete server from database')
      }
    } else {
      await deleteServerFromDb(serverId)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted MCP server`,
    })
  } catch (error) {
    console.error('Error deleting MCP server:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
