# Built-in MCP Server for Self-Management

The Zola chat interface now includes a built-in MCP (Model Context Protocol) server that allows the AI to dynamically manage MCP servers during conversations.

## Overview

This feature enables the AI assistant to:
- Add new MCP servers on-the-fly
- List and inspect configured MCP servers
- Update server configurations
- Remove servers that are no longer needed
- Test server connectivity

All management is done through natural language commands during your chat session.

## Available Tools

### 1. `add_mcp_server`

Add a new MCP server configuration.

**Parameters:**
- `name` (string, required): Name of the MCP server
- `description` (string, optional): Description of what this server provides
- `transportType` ("http" | "sse", required): Transport type
- `url` (string, required): URL of the MCP server endpoint
- `headers` (object, optional): HTTP headers for authentication
- `enabled` (boolean, optional): Enable immediately (default: true)

**Example usage:**
```
User: "Add the GitHub MCP server at https://api.githubcopilot.com/mcp/ with HTTP transport"

AI: [Calls add_mcp_server with appropriate parameters]
```

### 2. `list_mcp_servers`

List all configured MCP servers with their status.

**Parameters:**
- `includeDisabled` (boolean, optional): Include disabled servers (default: true)

**Example usage:**
```
User: "What MCP servers are currently configured?"

AI: [Calls list_mcp_servers to show all servers]
```

### 3. `update_mcp_server`

Update an existing MCP server configuration.

**Parameters:**
- `serverId` (string, required): ID of the server to update
- `name` (string, optional): New name
- `description` (string, optional): New description
- `url` (string, optional): New URL
- `headers` (object, optional): New headers
- `enabled` (boolean, optional): Enable/disable the server

**Example usage:**
```
User: "Disable the GitHub MCP server"

AI: [Calls list_mcp_servers to find the ID, then update_mcp_server to disable it]
```

### 4. `delete_mcp_server`

Remove an MCP server configuration.

**Parameters:**
- `serverId` (string, required): ID of the server to delete

**Example usage:**
```
User: "Remove the Context7 MCP server"

AI: [Calls list_mcp_servers to find the ID, then delete_mcp_server]
```

### 5. `test_mcp_server`

Test connectivity to an MCP server without adding it.

**Parameters:**
- `url` (string, required): URL of the server to test
- `transportType` ("http" | "sse", required): Transport type
- `headers` (object, optional): Headers for authentication

**Example usage:**
```
User: "Can you test if https://mcp.example.com/mcp/ is accessible?"

AI: [Calls test_mcp_server to verify connectivity]
```

### 6. `get_managed_servers`

Get the current list of enabled MCP servers.

**Parameters:** None

**Example usage:**
```
User: "Show me which servers are currently active"

AI: [Calls get_managed_servers to list enabled servers]
```

## How It Works

1. **Built-in Tools**: The MCP management tools are always available in every chat session
2. **In-Memory Storage**: Managed servers are stored in memory during the session
3. **Integration**: Servers added via these tools are automatically merged with user-configured servers
4. **AI-Driven**: The AI uses natural language understanding to know when to use these tools

## Use Cases

### Dynamic Server Discovery
```
User: "I need to search GitHub issues. Can you add the GitHub MCP server?"

AI: "I'll add the GitHub MCP server for you."
[Calls add_mcp_server]
AI: "GitHub MCP server added successfully. Now I can help you search issues."
```

### Server Management
```
User: "What MCP tools do I have available?"

AI: [Calls list_mcp_servers]
AI: "You currently have 3 MCP servers configured:
1. GitHub - for repository access
2. Exa - for web search
3. Context7 - for documentation lookup"
```

### Testing Before Adding
```
User: "Before adding https://mcp.newservice.com, can you check if it's working?"

AI: [Calls test_mcp_server]
AI: "The server is responding correctly. Would you like me to add it?"
```

## Technical Details

### Implementation

The built-in MCP server is implemented in `/lib/mcp/builtin-server.ts` and provides:
- Tool definitions using Zod schemas for validation
- In-memory storage for managed servers
- Integration with the existing `buildMcpTools` function

### Integration

The built-in tools are automatically merged with other MCP tools in the `buildMcpTools` function:
1. Built-in management tools are always included
2. Servers managed by these tools are added to the server list
3. All tools are available to the AI in the same chat session

### Persistence

**Note**: Currently, servers added via the AI tools are stored in memory and will be lost when the chat session ends. For persistent server management, use the MCP Settings UI in the application settings.

## Future Enhancements

Potential improvements for future versions:
- Persistent storage for AI-managed servers
- Integration with user's saved MCP configurations
- Automatic server discovery and recommendations
- Server health monitoring and alerts
- Tool usage analytics and recommendations

## Security Considerations

- Server configurations are only stored in memory
- No credentials are persisted automatically
- Authentication headers should be provided carefully
- Test servers before adding them to production use

## Troubleshooting

### Server Not Responding
If a server isn't responding:
1. Use `test_mcp_server` to verify connectivity
2. Check the URL and transport type are correct
3. Ensure authentication headers are provided if required

### Tools Not Available
If you don't see the management tools:
1. Verify you're using a recent version of Zola
2. Check that MCP support is enabled
3. Try asking the AI directly: "Can you list MCP servers?"

### Server Conflicts
If you get name conflicts:
1. List existing servers with `list_mcp_servers`
2. Use unique names for each server
3. Update or delete conflicting servers as needed
