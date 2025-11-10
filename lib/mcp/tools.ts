import { z, type ZodTypeAny } from "zod"
import type { ToolSet } from "ai"

export type McpToolsResult = {
  tools: ToolSet
  close?: () => void
}

/**
 * Build an AI SDK ToolSet from an MCP server (local via stdio or remote via HTTP/SSE).
 *
 * Env configuration:
 * - MCP_URL: URL to a remote MCP server (Streamable HTTP preferred; will fallback to SSE)
 * - MCP_LOCAL_CMD: Local command to spawn an MCP server via stdio (e.g. "node"), optional MCP_LOCAL_ARGS and MCP_LOCAL_ENV
 * - MCP_LOCAL_ARGS: JSON array of args, default ["server.js"]
 * - MCP_LOCAL_ENV: JSON object of env vars
 */
export async function buildMcpTools(): Promise<McpToolsResult> {
  const mcpUrl = process.env.MCP_URL
  const mcpCmd = process.env.MCP_LOCAL_CMD

  // No MCP configured
  if (!mcpUrl && !mcpCmd) {
    return { tools: {} }
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
  } else if (mcpCmd) {
    const args: string[] = safeParseJson(process.env.MCP_LOCAL_ARGS, ["stdio"]) || ["stdio"]
    const env = safeParseJson<Record<string, string>>(process.env.MCP_LOCAL_ENV, {}) || {}

    const { StdioClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/stdio.js"
    ) as any
    client = new Client({ name: "zola-app", version: "1.0.0" })
    const transport = new StdioClientTransport({ command: mcpCmd, args, env })
    await client.connect(transport)
    close = () => transport.close()
  }

  // If client failed (shouldn't happen), return empty tools
  if (!client) return { tools: {} }

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
    return { tools: {}, close }
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

  return { tools, close }
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
