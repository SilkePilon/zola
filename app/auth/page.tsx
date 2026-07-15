import { getAuthProviders } from "@/lib/auth-providers"
import LoginPage from "./login-page"

// Provider config is read from the environment at request time, so this page
// must not be prerendered into a static build artifact.
export const dynamic = "force-dynamic"

export default function AuthPage() {
  return <LoginPage providers={getAuthProviders()} />
}
