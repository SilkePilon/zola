// Remote MCP loader using official MCP SDK (Streamable HTTP with SSE fallback)
export async function loadMCPToolsFromURL(url: string) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js") as any
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  ) as any
  const { SSEClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/sse.js"
  ) as any

  const client = new Client({ name: "zola-app", version: "1.0.0" })

  let close: (() => void) | undefined
  try {
    const transport = new StreamableHTTPClientTransport(new URL(url))
    await client.connect(transport)
    close = () => transport.close()
  } catch {
    const transport = new SSEClientTransport(new URL(url))
    await client.connect(transport)
    close = () => transport.close()
  }

  const tools = await client.listTools()
  return { tools, close: () => close?.() }
}
