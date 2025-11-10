export type MCPTransportType = "stdio" | "http" | "sse"

export type MCPServerConfig = {
  id: string
  name: string
  description?: string
  enabled: boolean
  transportType: MCPTransportType
  
  // STDIO specific
  command?: string
  args?: string[]
  env?: Record<string, string>
  
  // HTTP/SSE specific
  url?: string
  headers?: Record<string, string>
  
  // UI
  icon?: string
  
  // Metadata
  createdAt: string
  updatedAt: string
}

export type MCPServerStatus = {
  id: string
  connected: boolean
  error?: string
  lastChecked?: string
  toolsCount?: number
}
