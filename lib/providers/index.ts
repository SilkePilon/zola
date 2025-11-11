import Anthropic from "@/components/icons/anthropic"
import Claude from "@/components/icons/claude"
import DeepSeek from "@/components/icons/deepseek"
import Gemini from "@/components/icons/gemini"
import Google from "@/components/icons/google"
import Grok from "@/components/icons/grok"
import Meta from "@/components/icons/meta"
import Mistral from "@/components/icons/mistral"
import Ollama from "@/components/icons/ollama"
import OpenAI from "@/components/icons/openai"
import OpenRouter from "@/components/icons/openrouter"
import Preplexity from "@/components/icons/perplexity"
import Xai from "@/components/icons/xai"

export type Provider = {
  id: string
  name: string
  available: boolean
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

/**
 * Static icon mapping for known providers
 * This is a fallback - the system primarily uses dynamic data from models.dev API
 */
const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  anthropic: Anthropic,
  claude: Claude,
  deepseek: DeepSeek,
  gemini: Gemini,
  google: Google,
  grok: Grok,
  meta: Meta,
  mistral: Mistral,
  ollama: Ollama,
  openai: OpenAI,
  openrouter: OpenRouter,
  perplexity: Preplexity,
  xai: Xai,
}

/**
 * Get icon component for a provider
 * Falls back to a generic icon if not found
 */
export function getProviderIcon(providerId: string): React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined {
  return ICON_MAP[providerId.toLowerCase()]
}

/**
 * Legacy static provider list for backward compatibility
 * This is no longer the source of truth - use the dynamic API instead
 * @deprecated Use getAllProviders() from registry.ts instead
 */
export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: OpenRouter,
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: OpenAI,
  },
  {
    id: "mistral",
    name: "Mistral",
    icon: Mistral,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: DeepSeek,
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: Gemini,
  },
  {
    id: "claude",
    name: "Claude",
    icon: Claude,
  },
  {
    id: "grok",
    name: "Grok",
    icon: Grok,
  },
  {
    id: "xai",
    name: "XAI",
    icon: Xai,
  },
  {
    id: "google",
    name: "Google",
    icon: Google,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: Anthropic,
  },
  {
    id: "ollama",
    name: "Ollama",
    icon: Ollama,
  },
  {
    id: "meta",
    name: "Meta",
    icon: Meta,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    icon: Preplexity,
  },
] as Provider[]
