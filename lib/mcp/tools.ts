import { z, type ZodTypeAny } from "zod"
import type { ToolSet } from "ai"
import { createBuiltinMCPTools, getManagedServers } from "./builtin-server"

export type MCPServerConfig = {
  id: string
  name: string
  description?: string
  enabled: boolean
  transportType: "http" | "sse"
  url?: string
  headers?: Record<string, string>
}

export type McpToolsResult = {
  tools: ToolSet
  close?: () => void
}

/**
 * Build an AI SDK ToolSet from MCP servers.
 * 
 * @param mcpServers - Array of MCP server configurations from the user's settings.
 *                     If not provided, falls back to env vars (MCP_URL, MCP_LOCAL_CMD).
 */
export async function buildMcpTools(mcpServers?: MCPServerConfig[]): Promise<McpToolsResult> {
  // Always include built-in MCP management tools
  const builtinTools = createBuiltinMCPTools()
  
  // Add servers managed by the built-in tools to the list
  const managedServers = getManagedServers()
  const allServers = [
    ...(mcpServers || []),
    ...managedServers,
  ]
  
  // If server configs provided, use them instead of env vars
  if (allServers.length > 0) {
    const result = await buildMcpToolsFromConfigs(allServers)
    // Merge built-in tools with MCP tools from servers
    return {
      tools: {
        ...builtinTools,
        ...result.tools,
      },
      close: result.close,
    }
  }
  
  // Fallback to env-based configuration for backward compatibility
  const mcpUrl = process.env.MCP_URL

  // No MCP configured - return just built-in tools
  if (!mcpUrl) {
    return { tools: builtinTools }
  }

  // Lazy import to keep cold starts smaller when unused
  const {
    Client,
  } = await import("@modelcontextprotocol/sdk/client/index.js") as {
    Client: new (config: { name: string; version: string }) => {
      connect: (transport: unknown) => Promise<void>
      listTools: () => Promise<unknown>
      callTool: (args: { name: string; arguments: unknown }) => Promise<unknown>
    }
  }

  let client: InstanceType<typeof Client> | null = null
  let close: (() => void) | undefined

  if (mcpUrl) {
    // Prefer Streamable HTTP, fallback to SSE if needed
    const { StreamableHTTPClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/streamableHttp.js"
    ) as any
    const { SSEClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/sse.js"
    ) as any

    client = new Client({ name: "zola-app", version: "1.0.0" })
    try {
      const transport = new StreamableHTTPClientTransport(new URL(mcpUrl))
      await client.connect(transport)
      close = () => transport.close()
    } catch {
      const transport = new SSEClientTransport(new URL(mcpUrl))
      await client.connect(transport)
      close = () => transport.close()
    }
  }

  // If client failed (shouldn't happen), return just built-in tools
  if (!client) return { tools: builtinTools }

  // List tools from MCP, map to AI SDK tools
  let listed: Array<{ name: string; description?: string; inputSchema?: unknown }> = []
  try {
    const result = await client.listTools()
    // MCP SDK returns tools in a specific format - extract them
    if (result && typeof result === 'object' && 'tools' in result && Array.isArray(result.tools)) {
      listed = result.tools as Array<{ name: string; description?: string; inputSchema?: unknown }>
    } else if (Array.isArray(result)) {
      listed = result as Array<{ name: string; description?: string; inputSchema?: unknown }>
    }
  } catch (err) {
    console.error("MCP listTools failed:", err)
    return { tools: builtinTools, close }
  }

  const tools: ToolSet = {}
  for (const t of listed) {
    const name = t.name
    const description = t.description

    let inputSchema: ZodTypeAny
    try {
      inputSchema = t.inputSchema ? jsonSchemaToZod(t.inputSchema) : z.any()
    } catch (e) {
      console.warn(`Failed to convert JSON Schema for tool ${name}; falling back to z.any()`, e)
      inputSchema = z.any()
    }

    tools[name] = {
      description,
      inputSchema,
      execute: async (args: unknown) => {
        if (!client) return { error: 'Client not initialized' }
        try {
          const result = await client.callTool({ name, arguments: args })
          if (result && typeof result === 'object' && 'structuredContent' in result) {
            return (result as { structuredContent: unknown }).structuredContent
          }
          return result
        } catch (err) {
          return { error: String((err as Error)?.message || err) }
        }
      },
    }
  }

  // Merge built-in tools with MCP tools
  return { 
    tools: {
      ...builtinTools,
      ...tools,
    }, 
    close 
  }
}

function safeParseJson<T = unknown>(input: string | undefined, fallback: T): T | undefined {
  if (!input) return fallback
  try {
    return JSON.parse(input) as T
  } catch {
    return fallback
  }
}

type JsonSchema = Record<string, unknown> & {
  type?: string | string[]
  enum?: unknown[]
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  allOf?: JsonSchema[]
  $ref?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean | JsonSchema
  items?: JsonSchema
  minLength?: number
  maxLength?: number
  pattern?: string
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  nullable?: boolean
  default?: unknown
}

// Basic JSON Schema → Zod converter covering common cases used by MCP tools.
function jsonSchemaToZod(schema: unknown): ZodTypeAny {
  if (!schema || typeof schema !== "object") return z.any()

  // Handle boolean schema (true/false)
  if (schema === true as unknown) return z.any()
  if (schema === false as unknown) return z.never()

  const s = schema as JsonSchema

  // $ref not supported in this minimal converter
  if (s.$ref) return z.any()

  // Enum has priority
  if (Array.isArray(s.enum) && s.enum.length > 0) {
    const allStrings = s.enum.every((v) => typeof v === "string")
    if (allStrings) {
      return z.enum(s.enum as [string, ...string[]]) as unknown as ZodTypeAny
    }
    // For mixed types, use union of literals
    const literals = s.enum.map((v) => {
      // Type guard for literal values
      const val = v as string | number | boolean | null
      return z.literal(val)
    })
    if (literals.length === 1) return literals[0]
    if (literals.length >= 2) {
      return z.union([literals[0], literals[1], ...literals.slice(2)])
    }
    return z.any()
  }

  // oneOf/anyOf → union
  if (Array.isArray(s.oneOf) && s.oneOf.length > 0) {
    return z.union(s.oneOf.map((subSchema) => jsonSchemaToZod(subSchema)) as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]])
  }
  if (Array.isArray(s.anyOf) && s.anyOf.length > 0) {
    return z.union(s.anyOf.map((subSchema) => jsonSchemaToZod(subSchema)) as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]])
  }

  // allOf → intersection (best-effort)
  if (Array.isArray(s.allOf) && s.allOf.length > 0) {
    return s.allOf.map((subSchema) => jsonSchemaToZod(subSchema)).reduce((acc: ZodTypeAny, cur: ZodTypeAny) => z.intersection(acc, cur))
  }

  // Type can be array (union of types)
  if (Array.isArray(s.type) && s.type.length > 0) {
    return z.union(s.type.map((t) => jsonSchemaToZod({ ...s, type: t })) as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]])
  }

  switch (s.type) {
    case "string": {
      let str = z.string()
      if (typeof s.minLength === "number") str = str.min(s.minLength)
      if (typeof s.maxLength === "number") str = str.max(s.maxLength)
      if (typeof s.pattern === "string") {
        try { str = str.regex(new RegExp(s.pattern)) } catch {}
      }
      return applyNullableAndDefault(str, s)
    }
    case "integer": {
      let n = z.number().int()
      if (typeof s.minimum === "number") n = n.min(s.minimum)
      if (typeof s.maximum === "number") n = n.max(s.maximum)
      return applyNullableAndDefault(n, s)
    }
    case "number": {
      let n = z.number()
      if (typeof s.minimum === "number") n = n.min(s.minimum)
      if (typeof s.maximum === "number") n = n.max(s.maximum)
      return applyNullableAndDefault(n, s)
    }
    case "boolean": {
      return applyNullableAndDefault(z.boolean(), s)
    }
    case "null": {
      return z.null()
    }
    case "array": {
      const itemSchema = s.items ? jsonSchemaToZod(s.items) : z.any()
      let a = z.array(itemSchema)
      if (typeof s.minItems === "number") a = a.min(s.minItems)
      if (typeof s.maxItems === "number") a = a.max(s.maxItems)
      return applyNullableAndDefault(a, s)
    }
    case "object": {
      const props = s.properties || {}
      const required: string[] = Array.isArray(s.required) ? s.required : []
      const shape: Record<string, ZodTypeAny> = {}
      for (const key of Object.keys(props)) {
        const propSchema = jsonSchemaToZod(props[key])
        shape[key] = required.includes(key) ? propSchema : z.optional(propSchema)
      }
      let o = z.object(shape)
      if (s.additionalProperties === false) {
        o = o.strict()
      } else if (s.additionalProperties && typeof s.additionalProperties === "object") {
        // allow arbitrary keys matching given schema
        o = o.catchall(jsonSchemaToZod(s.additionalProperties))
      } else {
        o = o.passthrough()
      }
      return applyNullableAndDefault(o, s)
    }
    default: {
      // Fallback for missing type but having properties (assume object)
      if (s.properties || s.additionalProperties) {
        return jsonSchemaToZod({ ...s, type: "object" })
      }
      return z.any()
    }
  }
}

function applyNullableAndDefault<T extends ZodTypeAny>(base: T, schema: JsonSchema): ZodTypeAny {
  let out: ZodTypeAny = base
  // nullable
  if (schema.nullable === true) out = z.union([out, z.null()])
  // default
  if (schema.default !== undefined) out = out.default(schema.default)
  return out
}

/**
 * Retry a connection with exponential backoff
 */
async function retryConnection<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Connection attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * Build MCP tools from multiple server configurations.
 * Connects to all servers in parallel and merges their tools.
 */
async function buildMcpToolsFromConfigs(configs: MCPServerConfig[]): Promise<McpToolsResult> {
  const {
    Client,
  } = await import("@modelcontextprotocol/sdk/client/index.js") as {
    Client: new (config: { name: string; version: string }) => {
      connect: (transport: unknown) => Promise<void>
      listTools: () => Promise<unknown>
      callTool: (args: { name: string; arguments: unknown }) => Promise<unknown>
    }
  }

  const clients: Array<{
    client: InstanceType<typeof Client>
    close?: () => void
    serverName: string
  }> = []

  // Connect to all servers in parallel with retry logic
  const connectionResults = await Promise.allSettled(
    configs.map(async (config) => {
      return retryConnection(async () => {
        const client = new Client({ name: "zola-app", version: "1.0.0" })
        let close: (() => void) | undefined

        if (config.transportType === "http" && config.url) {
          const { StreamableHTTPClientTransport } = await import(
            "@modelcontextprotocol/sdk/client/streamableHttp.js"
          ) as any
          const transport = new StreamableHTTPClientTransport(
            new URL(config.url),
            {
              requestInit: {
                headers: config.headers || {}
              }
            }
          )
          await client.connect(transport)
          close = () => transport.close()
        } else if (config.transportType === "sse" && config.url) {
          const { SSEClientTransport } = await import(
            "@modelcontextprotocol/sdk/client/sse.js"
          ) as any
          const transport = new SSEClientTransport(
            new URL(config.url),
            {
              requestInit: {
                headers: config.headers || {}
              }
            }
          )
          await client.connect(transport)
          close = () => transport.close()
        } else {
          throw new Error(`Invalid config for server ${config.name}`)
        }

        return { client, close, serverName: config.name }
      }, 2, 1000) // 2 retries with 1s base delay
    })
  )

  // Collect successful connections
  for (const result of connectionResults) {
    if (result.status === "fulfilled") {
      clients.push(result.value)
    } else {
      console.warn("Failed to connect to MCP server:", result.reason)
    }
  }

  if (clients.length === 0) {
    return { tools: {} }
  }

  // Gather tools from all connected servers
  const allTools: ToolSet = {}
  const closeFns: Array<() => void> = []

  for (const { client, close, serverName } of clients) {
    if (close) closeFns.push(close)

    try {
      let listed: Array<{ name: string; description?: string; inputSchema?: unknown }> = []
      const result = await client.listTools()
      
      if (result && typeof result === 'object' && 'tools' in result && Array.isArray(result.tools)) {
        listed = result.tools as Array<{ name: string; description?: string; inputSchema?: unknown }>
      } else if (Array.isArray(result)) {
        listed = result as Array<{ name: string; description?: string; inputSchema?: unknown }>
      }

      // Add tools with server name prefix to avoid collisions
      for (const t of listed) {
        const toolName = `${serverName}__${t.name}`
        const description = t.description

        let inputSchema: ZodTypeAny
        try {
          inputSchema = t.inputSchema ? jsonSchemaToZod(t.inputSchema) : z.any()
        } catch (e) {
          console.warn(`Failed to convert JSON Schema for tool ${toolName}; falling back to z.any()`, e)
          inputSchema = z.any()
        }

        allTools[toolName] = {
          description: `[${serverName}] ${description || ''}`,
          inputSchema,
          execute: async (args: unknown) => {
            try {
              // Retry tool calls with exponential backoff
              const result = await retryConnection(
                async () => await client.callTool({ name: t.name, arguments: args }),
                2, // 2 retries
                500 // 500ms base delay for tool calls
              )
              if (result && typeof result === 'object' && 'structuredContent' in result) {
                return (result as { structuredContent: unknown }).structuredContent
              }
              return result
            } catch (err) {
              console.error(`Tool call failed for ${toolName}:`, err)
              return { error: String((err as Error)?.message || err) }
            }
          },
        }
      }
    } catch (err) {
      console.error(`Failed to list tools from ${serverName}:`, err)
    }
  }

  // Return unified close function
  const closeAll = closeFns.length > 0 ? () => {
    for (const fn of closeFns) {
      try { fn() } catch (e) { console.warn("Error closing MCP connection:", e) }
    }
  } : undefined

  return { tools: allTools, close: closeAll }
}
