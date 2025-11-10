"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { useMCP } from "@/lib/mcp-store/provider"
import type { MCPServerConfig, MCPTransportType } from "@/lib/mcp-store/types"
import { cn } from "@/lib/utils"
import { 
  PlusCircle, 
  Trash2, 
  Edit2, 
  Power, 
  PowerOff, 
  Server,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wrench
} from "lucide-react"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "motion/react"
import mcpDirectory from "@/lib/mcp/directory.json"

type ServerFormData = Omit<MCPServerConfig, "id" | "createdAt" | "updatedAt">

const defaultFormData: ServerFormData = {
  name: "",
  description: "",
  enabled: true,
  transportType: "http",
  url: "",
  headers: {},
  authBearer: false,
}

type MCPDirectoryEntry = {
  name: string
  description: string
  icon: string
  transportType: MCPTransportType
  url?: string
  requiresAuth: boolean
  authPlaceholder?: string
  authHeader?: string
  authEnvKey?: string
  authBearer?: boolean
}

export function MCPSettings() {
  const { servers, statuses, addServer, updateServer, deleteServer, toggleServer } = useMCP()
  const [isDirectoryDialogOpen, setIsDirectoryDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null)
  const [formData, setFormData] = useState<ServerFormData>(defaultFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<MCPDirectoryEntry | null>(null)
  const [authValue, setAuthValue] = useState("")
  const [mcpPresets, setMcpPresets] = useState<MCPDirectoryEntry[]>(mcpDirectory as MCPDirectoryEntry[])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [serverToDelete, setServerToDelete] = useState<{ id: string; name: string } | null>(null)

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", status: "error" })
      return
    }

    if ((formData.transportType === "http" || formData.transportType === "sse") && !formData.url) {
      toast({ title: "URL is required for HTTP/SSE transport", status: "error" })
      return
    }

    setIsSubmitting(true)
    setTestResult(null)

    // Test connection first
    try {
      const testConfig: MCPServerConfig = {
        id: "test",
        name: formData.name,
        description: formData.description,
        enabled: true,
        transportType: formData.transportType,
        url: formData.url,
        headers: formData.headers,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const { testMCPConnection } = await import("@/lib/mcp-store/client")
      const result = await testMCPConnection(testConfig)

      if (!result.success) {
        setTestResult({
          success: false,
          message: `✗ Connection test failed: ${result.error}`,
        })
        toast({
          title: "Connection test failed",
          description: result.error || "Cannot save server with failed connection",
          status: "error",
        })
        setIsSubmitting(false)
        return
      }

      // Connection successful, show success message
      setTestResult({
        success: true,
        message: `✓ Connection successful! Found ${result.toolsCount || 0} tools`,
      })

      // Add server
      await addServer(formData)
      toast({ title: "MCP server added successfully" })
      setIsAddDialogOpen(false)
      setFormData(defaultFormData)
      setTestResult(null)
    } catch (error) {
      toast({ 
        title: "Failed to add server", 
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error" 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editingServer) return

    if (!formData.name.trim()) {
      toast({ title: "Name is required", status: "error" })
      return
    }

    setIsSubmitting(true)
    setTestResult(null)

    // Test connection first
    try {
      const testConfig: MCPServerConfig = {
        id: editingServer.id,
        name: formData.name,
        description: formData.description,
        enabled: true,
        transportType: formData.transportType,
        url: formData.url,
        headers: formData.headers,
        createdAt: editingServer.createdAt,
        updatedAt: new Date().toISOString(),
      }

      const { testMCPConnection } = await import("@/lib/mcp-store/client")
      const result = await testMCPConnection(testConfig)

      if (!result.success) {
        setTestResult({
          success: false,
          message: `✗ Connection test failed: ${result.error}`,
        })
        toast({
          title: "Connection test failed",
          description: result.error || "Cannot save server with failed connection",
          status: "error",
        })
        setIsSubmitting(false)
        return
      }

      // Connection successful, show success message
      setTestResult({
        success: true,
        message: `✓ Connection successful! Found ${result.toolsCount || 0} tools`,
      })

      // Update server
      await updateServer(editingServer.id, formData)
      toast({ title: "MCP server updated successfully" })
      setIsEditDialogOpen(false)
      setEditingServer(null)
      setFormData(defaultFormData)
      setTestResult(null)
    } catch (error) {
      toast({ 
        title: "Failed to update server", 
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error" 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (id: string, name: string) => {
    setServerToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!serverToDelete) return

    try {
      await deleteServer(serverToDelete.id)
      toast({ title: "MCP server deleted successfully" })
      setDeleteDialogOpen(false)
      setServerToDelete(null)
    } catch (error) {
      toast({ 
        title: "Failed to delete server", 
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error" 
      })
      setDeleteDialogOpen(false)
      setServerToDelete(null)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await toggleServer(id)
    } catch (error) {
      toast({ 
        title: "Failed to toggle server", 
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error" 
      })
    }
  }

  const openEditDialog = (server: MCPServerConfig) => {
    setEditingServer(server)
    setFormData({
      name: server.name,
      description: server.description,
      enabled: server.enabled,
      transportType: server.transportType,
      url: server.url,
      headers: server.headers,
      authBearer: server.authBearer,
    })
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData(defaultFormData)
    setEditingServer(null)
    setTestResult(null)
    setSelectedPreset(null)
    setAuthValue("")
  }

  const handlePresetSelect = (preset: MCPDirectoryEntry) => {
    setSelectedPreset(preset)
    setAuthValue("")
  }

  const handlePresetAdd = async () => {
    if (!selectedPreset) return

    setIsSubmitting(true)
    try {
      const serverData: ServerFormData = {
        name: selectedPreset.name,
        description: selectedPreset.description,
        enabled: true,
        transportType: selectedPreset.transportType,
        url: selectedPreset.url,
        headers: selectedPreset.authHeader && authValue
          ? { [selectedPreset.authHeader]: selectedPreset.authBearer ? `Bearer ${authValue}` : authValue }
          : undefined,
        authBearer: selectedPreset.authBearer,
      }

      // Test connection
      const testConfig: MCPServerConfig = {
        id: "test",
        ...serverData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      try {
        const response = await fetch("/api/mcp/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testConfig),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error("Connection test failed")
        }

        await addServer(serverData)
        toast({ title: `${selectedPreset.name} server added successfully` })
        setIsDirectoryDialogOpen(false)
        resetForm()
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Connection timeout - server took too long to respond")
        }
        throw error
      }
    } catch (error) {
      toast({
        title: "Failed to add server",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="mb-2 text-lg font-medium">MCP Servers</h3>
          <p className="text-muted-foreground text-sm">
            Configure Model Context Protocol servers to extend your AI capabilities with custom tools.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsDirectoryDialogOpen(true)}>
          <PlusCircle className="mr-2 size-4" />
          Add Server
        </Button>
      </div>

      {/* Server Directory Dialog */}
      <Dialog open={isDirectoryDialogOpen} onOpenChange={(open) => {
        setIsDirectoryDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
            <DialogDescription>
              Choose from popular MCP servers or install manually
            </DialogDescription>
          </DialogHeader>

          {!selectedPreset ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                {mcpPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetSelect(preset)}
                    className="flex items-start gap-3 rounded-lg border border-border bg-transparent p-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{preset.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {preset.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {preset.transportType.toUpperCase()}
                        </Badge>
                        {preset.requiresAuth && (
                          <Badge variant="outline" className="text-xs">
                            Requires Auth
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="size-4 rotate-[-90deg] text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsDirectoryDialogOpen(false)
                    setIsAddDialogOpen(true)
                  }}
                >
                  <PlusCircle className="mr-2 size-4" />
                  Manual Installation
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-accent/20 p-3">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{selectedPreset.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedPreset.description}
                  </p>
                </div>
              </div>

              {selectedPreset.requiresAuth && (
                <div className="space-y-2">
                  <Label htmlFor="auth">
                    {selectedPreset.authPlaceholder} *
                  </Label>
                  <Input
                    id="auth"
                    type="password"
                    placeholder={selectedPreset.authPlaceholder}
                    value={authValue}
                    onChange={(e) => setAuthValue(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be securely stored and used for authentication
                  </p>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPreset(null)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  onClick={handlePresetAdd}
                  disabled={isSubmitting || (selectedPreset.requiresAuth && !authValue)}
                >
                  {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {isSubmitting ? "Installing..." : "Install Server"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manual Installation</DialogTitle>
            <DialogDescription>
              Configure a custom MCP server manually
            </DialogDescription>
          </DialogHeader>

            <ServerForm formData={formData} setFormData={setFormData} />

            {testResult && (
              <div
                className={cn(
                  "rounded-md border p-3 text-sm",
                  testResult.success
                    ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-200"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-200"
                )}
              >
                {testResult.message}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false)
                  resetForm()
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isSubmitting ? "Testing & Saving..." : "Add Server"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit MCP Server</DialogTitle>
            <DialogDescription>
              Update your MCP server configuration
            </DialogDescription>
          </DialogHeader>

          <ServerForm formData={formData} setFormData={setFormData} />

          {testResult && (
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                testResult.success
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-200"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-200"
              )}
            >
              {testResult.message}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                resetForm()
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isSubmitting ? "Testing & Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Server List */}
      <div className="space-y-3">
        {servers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-border text-muted-foreground flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed"
          >
            <Server className="mb-3 size-12 opacity-50" />
            <h4 className="mb-2 font-medium text-foreground">No MCP servers configured</h4>
            <p className="text-muted-foreground text-center text-sm">
              Add your first MCP server to get started with extended AI capabilities
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {servers.map((server: MCPServerConfig) => (
              <ServerCard
                key={server.id}
                server={server}
                status={statuses[server.id]}
                onToggle={handleToggle}
                onEdit={openEditDialog}
                onDelete={handleDeleteClick}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MCP Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{serverToDelete?.name}"? This action cannot be undone and you will lose access to all tools provided by this server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Server Card Component with expandable tools
function ServerCard({
  server,
  status,
  onToggle,
  onEdit,
  onDelete,
}: {
  server: MCPServerConfig
  status?: { connected: boolean; error?: string; toolsCount?: number }
  onToggle: (id: string) => void
  onEdit: (server: MCPServerConfig) => void
  onDelete: (id: string, name: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [tools, setTools] = useState<string[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load tools when server is enabled or configuration changes
  useEffect(() => {
    if (server.enabled && server.updatedAt) {
      loadTools()
    } else {
      setTools([])
    }
  }, [server.enabled, server.id, server.updatedAt])

  const loadTools = async () => {
    setIsLoadingTools(true)
    setLoadError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout
      
      const response = await fetch('/api/mcp/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers: [server] }),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        const toolsList = Object.keys(data.tools || {})
        if (toolsList.length > 0) {
          setTools(toolsList)
          setLoadError(null)
        } else if (toolsList.length === 0) {
          setTools([])
          setLoadError('No tools available')
        }
      } else {
        setLoadError('Failed to connect to server')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setLoadError('Connection timeout')
      } else {
        setLoadError('Failed to load tools')
      }
      console.error('Failed to load tools:', error)
    } finally {
      setIsLoadingTools(false)
    }
  }

  return (
    <div className="border-border group rounded-lg border bg-transparent p-3 transition-colors hover:bg-accent/5">

      <div className="flex items-start justify-between gap-3">
        {/* Server Info */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-medium text-sm">{server.name}</h4>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {server.transportType.toUpperCase()}
            </Badge>
            {status && (
              <Tooltip>
                <TooltipTrigger>
                  {status.connected ? (
                    <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                  ) : status.error ? (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  ) : null}
                </TooltipTrigger>
                <TooltipContent>
                  {status.connected 
                    ? `Connected • ${status.toolsCount || 0} tools`
                    : status.error || "Not connected"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {server.description && (
            <p className="text-muted-foreground mt-1 text-xs">
              {server.description}
            </p>
          )}

          {(server.transportType === "http" || server.transportType === "sse") && server.url && (
            <div className="flex items-center gap-1 text-muted-foreground mt-1.5 text-xs">
              <ExternalLink className="size-3" />
              <span className="truncate">{server.url}</span>
            </div>
          )}

          {/* Tools Display */}
          {server.enabled && tools.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center gap-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Wrench className="size-3" />
                <span>Available Tools ({tools.length})</span>
                {isExpanded ? (
                  <ChevronUp className="size-3 ml-auto" />
                ) : (
                  <ChevronDown className="size-3 ml-auto" />
                )}
              </button>
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1.5 space-y-1">
                      {tools.map((tool, index) => (
                        <motion.div
                          key={tool}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ 
                            duration: 0.2, 
                            delay: index * 0.03,
                            ease: [0.4, 0, 0.2, 1]
                          }}
                          className="bg-accent/50 hover:bg-accent text-foreground rounded-md px-2.5 py-1.5 text-xs font-mono transition-colors border border-border/50"
                        >
                            {tool}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

          {server.enabled && isLoadingTools && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              <span>Loading tools...</span>
            </div>
          )}

          {server.enabled && loadError && !isLoadingTools && tools.length === 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <XCircle className="size-3" />
              <span>{loadError}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToggle(server.id)}
                className="text-muted-foreground hover:text-foreground border-border rounded-md border p-1.5 transition-colors hover:bg-accent"
              >
                {server.enabled ? (
                  <Power className="size-4" />
                ) : (
                  <PowerOff className="size-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {server.enabled ? "Disable" : "Enable"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onEdit(server)}
                className="text-muted-foreground hover:text-foreground border-border rounded-md border p-1.5 transition-colors hover:bg-accent"
              >
                <Edit2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDelete(server.id, server.name)}
                className="text-muted-foreground hover:text-foreground border-border rounded-md border p-1.5 transition-colors hover:bg-accent"
              >
                <Trash2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

// Server Form Component
function ServerForm({
  formData,
  setFormData,
}: {
  formData: ServerFormData
  setFormData: (data: ServerFormData) => void
}) {
  const [headersText, setHeadersText] = useState(
    Object.entries(formData.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
  )

  const updateField = <K extends keyof ServerFormData>(
    field: K,
    value: ServerFormData[K]
  ) => {
    setFormData({ ...formData, [field]: value })
  }

  const parseHeaders = (text: string) => {
    const headers: Record<string, string> = {}
    text.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split(":")
      if (key?.trim()) {
        headers[key.trim()] = valueParts.join(":").trim()
      }
    })
    updateField("headers", headers)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Server Name *</Label>
        <Input
          id="name"
          placeholder="My MCP Server"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="Describe what this server does..."
          value={formData.description || ""}
          onChange={(e) => updateField("description", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="transport">Transport Type *</Label>
        <Select
          value={formData.transportType}
          onValueChange={(value) => updateField("transportType", value as MCPTransportType)}
        >
          <SelectTrigger id="transport">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="http">HTTP (Remote Server)</SelectItem>
            <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {formData.transportType === "http" && "Connect to a remote HTTP server"}
          {formData.transportType === "sse" && "Connect via Server-Sent Events"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">Server URL *</Label>
        <Input
          id="url"
          type="url"
          placeholder="http://localhost:3000/mcp"
          value={formData.url || ""}
          onChange={(e) => updateField("url", e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Full URL to the MCP endpoint
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="headers">HTTP Headers</Label>
        <Textarea
          id="headers"
          placeholder="Authorization: Bearer your-token&#10;X-API-Key: your-api-key&#10;Content-Type: application/json"
          value={headersText}
          onChange={(e) => {
            setHeadersText(e.target.value)
            parseHeaders(e.target.value)
          }}
          rows={4}
          className="font-mono text-sm"
        />
        <div className="text-muted-foreground space-y-1 text-xs">
          <p className="font-medium">Format: One header per line</p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li><code className="bg-muted rounded px-1">Header-Name: value</code></li>
            <li><code className="bg-muted rounded px-1">Authorization: Bearer token</code></li>
            <li><code className="bg-muted rounded px-1">X-API-Key: ctx7sk-abc123...</code></li>
          </ul>
          <p className="mt-2">The colon (<code className="bg-muted rounded px-1">:</code>) separates header name from value</p>
        </div>
      </div>
    </div>
  )
}
