"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "@phosphor-icons/react";
import { Power, PowerOff } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMCP } from "@/lib/mcp-store/provider";
import { useState, useEffect } from "react";

interface MCPServersSubmenuProps {
  onBack: () => void;
  onClose: () => void;
}

export function MCPServersSubmenu({ onBack, onClose }: MCPServersSubmenuProps) {
  const { servers, toggleServer, statuses } = useMCP();
  const [toolCounts, setToolCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadToolCounts = async () => {
      const counts: Record<string, number> = {};
      
      for (const server of servers) {
        if (server.enabled) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('/api/mcp/tools', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ servers: [server] }),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              const toolsList = Object.keys(data.tools || {});
              counts[server.id] = toolsList.length;
            }
          } catch (error) {
            // Silently fail
          }
        }
      }
      
      setToolCounts(counts);
    };

    loadToolCounts();
  }, [servers]);

  const handleToggle = async (serverId: string) => {
    try {
      await toggleServer(serverId);
    } catch (error) {
      console.error("Failed to toggle server:", error);
    }
  };

  const totalActiveTools = Object.values(toolCounts).reduce((sum, count) => sum + count, 0);

  return (
    <motion.div
      key="submenu"
      initial={{ x: 320, opacity: 1 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col w-full p-1.5"
    >
      <DropdownMenuItem
        onClick={(e) => {
          e.preventDefault();
          onBack();
        }}
        onSelect={(e) => e.preventDefault()}
        className="gap-2.5 h-8 cursor-pointer"
      >
        <ArrowLeft className="size-4 opacity-50" />
        <span className="opacity-60">Manage MCP servers</span>
        {totalActiveTools > 0 && (
          <Badge variant="secondary" className="ml-auto text-xs shrink-0">
            {totalActiveTools} {totalActiveTools === 1 ? 'tool' : 'tools'}
          </Badge>
        )}
      </DropdownMenuItem>

      {servers.length === 0 ? (
        <div className="px-1.5 py-3 text-center">
          <p className="text-xs text-muted-foreground">No MCP servers configured</p>
        </div>
      ) : (
        servers.map((server) => (
          <div
            key={server.id}
            className="flex items-center justify-between gap-2.5 px-1.5 py-2 rounded-lg hover:bg-accent/5 group/server"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm truncate">{server.name}</span>
                {server.enabled && toolCounts[server.id] !== undefined && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {toolCounts[server.id]}
                  </Badge>
                )}
              </div>
            </div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleToggle(server.id)}
                  className="text-muted-foreground hover:text-foreground border-border rounded-md border p-1 transition-colors hover:bg-accent shrink-0"
                >
                  {server.enabled ? (
                    <Power className="size-3.5" />
                  ) : (
                    <PowerOff className="size-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {server.enabled ? "Disable" : "Enable"}
              </TooltipContent>
            </Tooltip>
          </div>
        ))
      )}
    </motion.div>
  );
}
