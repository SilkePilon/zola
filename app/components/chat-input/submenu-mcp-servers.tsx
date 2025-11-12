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
        className="gap-2.5 h-8 cursor-pointer mb-1"
      >
        <ArrowLeft className="size-4 opacity-50" />
        <span className="opacity-60">Manage MCP servers</span>
      </DropdownMenuItem>

      {servers.length === 0 ? (
        <div className="px-2 py-4 text-center">
          <p className="text-xs text-muted-foreground">No MCP servers configured</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {servers.map((server) => (
            <div
              key={server.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors group/server"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-sm truncate leading-none">{server.name}</span>
                {server.enabled && toolCounts[server.id] !== undefined && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none">
                    {toolCounts[server.id]} {toolCounts[server.id] === 1 ? 'tool' : 'tools'}
                  </Badge>
                )}
                {server.headers?.Authorization && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none">
                    Auth
                  </Badge>
                )}
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleToggle(server.id)}
                    className="text-muted-foreground hover:text-foreground rounded-md border border-border p-1 transition-colors hover:bg-accent shrink-0"
                  >
                    {server.enabled ? (
                      <Power className="size-3.5" />
                    ) : (
                      <PowerOff className="size-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {server.enabled ? "Disable server" : "Enable server"}
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
