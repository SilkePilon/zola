"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUser } from "@/lib/user-store/provider"
import { User } from "@phosphor-icons/react"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const USER_PROFILE_ROW_ID = "settings-row-general-profile"

export function UserProfile() {
  const { user } = useUser()

  if (!user) return null

  return (
    <SettingsSection title="Profile">
      <SettingsRow id={USER_PROFILE_ROW_ID} title="Avatar">
        <div className="bg-fill-field flex size-10 items-center justify-center overflow-hidden rounded-full">
          {user?.profile_image ? (
            <Avatar className="size-10 rounded-full">
              <AvatarImage
                src={user.profile_image || undefined}
                className="object-cover"
              />
              <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="text-fg-muted size-6" />
          )}
        </div>
      </SettingsRow>
      <SettingsRow title="Full name">
        <span className="text-fg-primary text-sm">{user?.display_name}</span>
      </SettingsRow>
      <SettingsRow title="Email">
        <span className="text-fg-muted text-sm">{user?.email}</span>
      </SettingsRow>
    </SettingsSection>
  )
}
