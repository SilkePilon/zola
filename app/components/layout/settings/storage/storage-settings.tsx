"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { Database } from "@phosphor-icons/react"
import { useState } from "react"

export function StorageSettings() {
  const { preferences, updatePreference } = useUserPreferences()
  const [bucketName, setBucketName] = useState(preferences.storageBucket || "")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updatePreference("storageBucket", bucketName)
      toast({
        title: "Storage bucket saved",
        description: "Your storage configuration has been updated.",
        status: "success",
      })
    } catch (error) {
      console.error("Failed to save storage bucket:", error)
      toast({
        title: "Failed to save",
        description: "Could not save storage configuration.",
        status: "error",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setBucketName("")
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-primary mb-1 text-base font-medium">
          Storage Bucket
        </h3>
        <p className="text-muted-foreground text-sm">
          Configure your Supabase storage bucket for file uploads.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="bucket-name" className="text-sm">Bucket Name</Label>
          <Input
            id="bucket-name"
            placeholder="chat-attachments"
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            className="text-sm"
          />
          <p className="text-muted-foreground text-xs">
            Create a bucket in your Supabase project Storage section with public access enabled.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving || !bucketName} size="sm">
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isSaving} size="sm">
            Clear
          </Button>
        </div>

        {preferences.storageBucket && (
          <p className="text-muted-foreground text-xs">
            Current: <span className="font-medium">{preferences.storageBucket}</span>
          </p>
        )}
      </div>
    </div>
  )
}
