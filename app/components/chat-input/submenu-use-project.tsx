"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Plus } from "@phosphor-icons/react";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface UseProjectSubmenuProps {
  onBack: () => void;
  onClose: () => void;
}

export function UseProjectSubmenu({ onBack, onClose }: UseProjectSubmenuProps) {
  const handleStartNewProject = () => {
    // TODO: Implement new project creation
    onClose();
  };

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
        <span className="opacity-60">Use a project</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator className="mx-1.5" />

      <DropdownMenuItem
        onClick={(e) => {
          e.preventDefault();
          handleStartNewProject();
        }}
        onSelect={(e) => e.preventDefault()}
        className="gap-2.5 h-8 cursor-pointer"
      >
        <Plus className="size-4" />
        <span>Start a new project</span>
      </DropdownMenuItem>
    </motion.div>
  );
}
