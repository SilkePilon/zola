import type { mapUserRow } from "@/lib/db/mappers"
import type { UserPreferences } from "../user-preference-store/utils"

export type UserProfile = ReturnType<typeof mapUserRow> & {
  preferences?: UserPreferences
}
