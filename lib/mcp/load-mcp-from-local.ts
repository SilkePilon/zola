// Local MCP loader using official MCP SDK (stdio transport)
export async function loadMCPToolsFromLocal(
  command: string,
  env: Record<string, string> = {}
) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js") as any
  const { StdioClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/stdio.js"
  ) as any

  const client = new Client({ name: "zola-app", version: "1.0.0" })
  const transport = new StdioClientTransport({ command, args: ["stdio"], env })
  await client.connect(transport)

  const tools = await client.listTools()
  return { tools, close: () => transport.close() }
}
