"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { fetchClient } from "@/lib/fetch"
import { Check, ChevronDown, ChevronsUpDown, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type CustomModel = {
  id: string
  user_id: string
  name: string
  model_id: string
  provider_id: string
  base_url: string | null
  context_window: number | null
  input_cost: number | null
  output_cost: number | null
  vision: boolean
  tools: boolean
  reasoning: boolean
  audio: boolean
  video: boolean
  created_at: string
  updated_at: string
}

type AddCustomModelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingModel?: CustomModel | null
  onSuccess?: () => void
}

type ProviderItem = { id: string; name: string }

export function AddCustomModelDialog({
  open,
  onOpenChange,
  editingModel,
  onSuccess,
}: AddCustomModelDialogProps) {
  const [name, setName] = useState("")
  const [modelId, setModelId] = useState("")
  const [providerId, setProviderId] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [contextWindow, setContextWindow] = useState("")
  const [inputCost, setInputCost] = useState("")
  const [outputCost, setOutputCost] = useState("")
  const [vision, setVision] = useState(false)
  const [tools, setTools] = useState(false)
  const [reasoning, setReasoning] = useState(false)
  const [audio, setAudio] = useState(false)
  const [video, setVideo] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)

  // Populate form when editing
  useEffect(() => {
    if (editingModel) {
      setName(editingModel.name)
      setModelId(editingModel.model_id)
      setProviderId(editingModel.provider_id)
      setBaseUrl(editingModel.base_url || "")
      setContextWindow(editingModel.context_window?.toString() || "")
      setInputCost(editingModel.input_cost?.toString() || "")
      setOutputCost(editingModel.output_cost?.toString() || "")
      setVision(editingModel.vision)
      setTools(editingModel.tools)
      setReasoning(editingModel.reasoning)
      setAudio(editingModel.audio)
      setVideo(editingModel.video)
    } else {
      resetForm()
    }
  }, [editingModel, open])

  const providersQuery = useQuery({
    queryKey: ["providers"],
    queryFn: async (): Promise<ProviderItem[]> => {
      const res = await fetchClient("/api/providers", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load providers")
      const json = await res.json()
      return (json.providers || []) as ProviderItem[]
    },
  })

  const providers = providersQuery.data || []

  const createMutation = useMutation({
    mutationFn: async (data: {
      id?: string
      name: string
      modelId: string
      providerId: string
      baseUrl?: string
      contextWindow?: number
      inputCost?: number
      outputCost?: number
      vision: boolean
      tools: boolean
      reasoning: boolean
      audio: boolean
      video: boolean
    }) => {
      const { id, ...body } = data
      const res = await fetchClient(
        id ? `/api/custom-models?id=${id}` : "/api/custom-models",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) throw new Error(editingModel ? "Failed to update custom model" : "Failed to create custom model")
      return res.json()
    },
    onSuccess: () => {
      toast.success(editingModel ? "Custom model updated successfully" : "Custom model added successfully")
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        `Failed to ${editingModel ? "update" : "add"} custom model: ${error instanceof Error ? error.message : "Please try again."}`
      )
    },
  })

  const resetForm = () => {
    setName("")
    setModelId("")
    setProviderId("")
    setBaseUrl("")
    setContextWindow("")
    setInputCost("")
    setOutputCost("")
    setVision(false)
    setTools(false)
    setReasoning(false)
    setAudio(false)
    setVideo(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !modelId || !providerId) {
      toast.error("Please fill in all required fields")
      return
    }

    // Validate and parse numeric fields
    let parsedContextWindow: number | undefined
    let parsedInputCost: number | undefined
    let parsedOutputCost: number | undefined

    if (contextWindow && contextWindow.trim()) {
      const num = Number(contextWindow.trim())
      if (!Number.isFinite(num) || num < 0) {
        toast.error("Context window must be a valid positive number")
        return
      }
      parsedContextWindow = Math.floor(num)
    }

    if (inputCost && inputCost.trim()) {
      const num = Number(inputCost.trim())
      if (!Number.isFinite(num) || num < 0) {
        toast.error("Input cost must be a valid positive number")
        return
      }
      parsedInputCost = num
    }

    if (outputCost && outputCost.trim()) {
      const num = Number(outputCost.trim())
      if (!Number.isFinite(num) || num < 0) {
        toast.error("Output cost must be a valid positive number")
        return
      }
      parsedOutputCost = num
    }

    createMutation.mutate({
      id: editingModel?.id,
      name,
      modelId,
      providerId,
      baseUrl: baseUrl || undefined,
      contextWindow: parsedContextWindow,
      inputCost: parsedInputCost,
      outputCost: parsedOutputCost,
      vision,
      tools,
      reasoning,
      audio,
      video,
    })
  }

  const isCustomProvider = providerId === "custom"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingModel ? "Edit Custom Model" : "Add Custom Model"}</DialogTitle>
          <DialogDescription>
            {editingModel ? "Update your custom AI model settings." : "Add a custom AI model to your workspace."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Model Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="My Custom Model"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelId">
              Model ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="modelId"
              placeholder="gpt-4-custom"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">
              Provider <span className="text-destructive">*</span>
            </Label>
            <Popover open={providerOpen} onOpenChange={setProviderOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={providerOpen}
                  className="w-full justify-between"
                >
                  {providerId
                    ? [...providers, { id: "custom", name: "Custom" }].find(
                        (p) => p.id === providerId
                      )?.name
                    : "Select a provider"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search providers..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No provider found.</CommandEmpty>
                    <CommandGroup>
                      {providers.map((provider) => (
                        <CommandItem
                          key={provider.id}
                          value={provider.id}
                          onSelect={(currentValue) => {
                            setProviderId(currentValue)
                            setProviderOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              providerId === provider.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {provider.name}
                        </CommandItem>
                      ))}
                      <CommandItem
                        value="custom"
                        onSelect={(currentValue) => {
                          setProviderId(currentValue)
                          setProviderOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            providerId === "custom" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Custom
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {isCustomProvider && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">
                Base URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="baseUrl"
                placeholder="https://api.example.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required={isCustomProvider}
              />
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Capabilities</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vision"
                  checked={vision}
                  onCheckedChange={(checked) => setVision(checked as boolean)}
                />
                <Label htmlFor="vision" className="font-normal cursor-pointer">
                  Vision (Image understanding)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tools"
                  checked={tools}
                  onCheckedChange={(checked) => setTools(checked as boolean)}
                />
                <Label htmlFor="tools" className="font-normal cursor-pointer">
                  Tool Calls (Function calling)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reasoning"
                  checked={reasoning}
                  onCheckedChange={(checked) => setReasoning(checked as boolean)}
                />
                <Label htmlFor="reasoning" className="font-normal cursor-pointer">
                  Reasoning (Chain of thought)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="audio"
                  checked={audio}
                  onCheckedChange={(checked) => setAudio(checked as boolean)}
                />
                <Label htmlFor="audio" className="font-normal cursor-pointer">
                  Audio
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="video"
                  checked={video}
                  onCheckedChange={(checked) => setVideo(checked as boolean)}
                />
                <Label htmlFor="video" className="font-normal cursor-pointer">
                  Video
                </Label>
              </div>
            </div>
          </div>

          <Collapsible open={pricingOpen} onOpenChange={setPricingOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-accent">
              <h4 className="text-sm font-medium">Pricing & Context (Optional)</h4>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  pricingOpen && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contextWindow" className="text-xs">
                    Context (tokens)
                  </Label>
                  <Input
                    id="contextWindow"
                    type="number"
                    placeholder="1048576"
                    value={contextWindow}
                    onChange={(e) => setContextWindow(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inputCost" className="text-xs">
                    Input ($/1M)
                  </Label>
                  <Input
                    id="inputCost"
                    type="number"
                    step="0.01"
                    placeholder="0.10"
                    value={inputCost}
                    onChange={(e) => setInputCost(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="outputCost" className="text-xs">
                    Output ($/1M)
                  </Label>
                  <Input
                    id="outputCost"
                    type="number"
                    step="0.01"
                    placeholder="0.40"
                    value={outputCost}
                    onChange={(e) => setOutputCost(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {editingModel ? "Update Model" : "Add Model"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
