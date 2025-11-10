export type MCPTransportType = "http" | "sse"

export type MCPServerConfig = {
  id: string
  name: string
  description?: string
  enabled: boolean
  transportType: MCPTransportType
  
  // HTTP/SSE specific
  url?: string
  headers?: Record<string, string>
  
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
