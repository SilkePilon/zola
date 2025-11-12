"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Plus, FolderOpen, Check, DotsThree, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { useState, useCallback, useRef } from "react";
import { DialogCreateProject } from "@/app/components/layout/sidebar/dialog-create-project";
import { DialogDeleteProject } from "@/app/components/layout/sidebar/dialog-delete-project";
import { cn } from "@/lib/utils";
import { fetchClient } from "@/lib/fetch";

interface UseProjectSubmenuProps {
  onBack: () => void;
  onClose: () => void;
}

type Project = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
};

export function UseProjectSubmenu({ onBack, onClose }: UseProjectSubmenuProps) {
  const router = useRouter();
  const params = useParams<{ projectId?: string }>();
  const currentProjectId = params?.projectId;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      return response.json();
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({
      projectId,
      name,
    }: {
      projectId: string;
      name: string;
    }) => {
      const response = await fetchClient(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update project");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProjectId(null);
    },
  });

  const handleSelectProject = (projectId: string) => {
    if (editingProjectId) return;
    router.push(`/p/${projectId}`);
    onClose();
  };

  const handleStartEditing = (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingProjectId(project.id);
    setEditName(project.name);
    setOpenMenuId(null);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleSaveEdit = useCallback(() => {
    if (editingProjectId && editName.trim()) {
      updateProjectMutation.mutate({
        projectId: editingProjectId,
        name: editName.trim(),
      });
    } else {
      setEditingProjectId(null);
    }
  }, [editingProjectId, editName, updateProjectMutation]);

  const handleCancelEdit = useCallback(() => {
    setEditingProjectId(null);
    setEditName("");
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleDeleteClick = (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteProject(project);
    setOpenMenuId(null);
  };

  const handleStartNewProject = () => {
    setIsCreateDialogOpen(true);
  };

  return (
    <>
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

        {!isLoading && projects.length > 0 && (
          <>
            <DropdownMenuSeparator className="mx-1.5" />
            
            {projects.map((project) => (
              <div
                key={project.id}
                className={cn(
                  "hover:bg-accent/80 hover:text-foreground group/project relative w-full rounded-md transition-colors px-0.5",
                  (currentProjectId === project.id || editingProjectId === project.id || openMenuId === project.id) && 
                  "bg-accent hover:bg-accent text-foreground"
                )}
              >
                {editingProjectId === project.id ? (
                  <div className="bg-accent flex items-center rounded-md py-1.5 pr-1 pl-2">
                    <FolderOpen size={16} className="text-primary mr-2 flex-shrink-0" />
                    <input
                      ref={inputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-primary max-h-full w-full bg-transparent text-sm focus:outline-none"
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit();
                        }}
                        className="hover:bg-secondary text-muted-foreground hover:text-primary flex size-6 items-center justify-center rounded-md transition-colors duration-150"
                        type="button"
                      >
                        <Check size={14} weight="bold" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        className="hover:bg-secondary text-muted-foreground hover:text-primary flex size-6 items-center justify-center rounded-md transition-colors duration-150"
                        type="button"
                      >
                        <X size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleSelectProject(project.id)}
                      className="w-full text-left"
                    >
                      <div className="text-primary relative line-clamp-1 flex w-full items-center gap-2 mask-r-from-80% mask-r-to-85% px-2 py-1.5 text-sm text-ellipsis whitespace-nowrap">
                        <FolderOpen size={16} className="flex-shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </div>
                    </button>

                    <div className="absolute top-0 right-1 flex h-full items-center justify-center opacity-0 transition-opacity group-hover/project:opacity-100">
                      <div className="flex items-center gap-0.5">
                        {currentProjectId === project.id && (
                          <div className="flex size-6 items-center justify-center">
                            <Check size={14} weight="bold" className="text-primary" />
                          </div>
                        )}
                        <DropdownMenu
                          modal={false}
                          open={openMenuId === project.id}
                          onOpenChange={(open) => setOpenMenuId(open ? project.id : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              className="hover:bg-secondary flex size-6 items-center justify-center rounded-md transition-colors duration-150"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DotsThree size={16} className="text-primary" weight="bold" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStartEditing(project);
                              }}
                            >
                              <PencilSimple size={16} className="mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              variant="destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteClick(project);
                              }}
                            >
                              <Trash size={16} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}

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

      <DialogCreateProject
        isOpen={isCreateDialogOpen}
        setIsOpen={setIsCreateDialogOpen}
      />

      {deleteProject && (
        <DialogDeleteProject
          isOpen={!!deleteProject}
          setIsOpen={(open) => !open && setDeleteProject(null)}
          project={deleteProject}
        />
      )}
    </>
  );
}
