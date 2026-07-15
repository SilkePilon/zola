/**
 * Auth values shared by server and client code.
 *
 * This module must stay free of `server-only` and of any secret reads so that
 * client components can import it. Anything that touches provider credentials
 * belongs in `lib/auth-providers.ts` instead.
 */

/** Must match `emailAndPassword.minPasswordLength` in lib/auth.ts. */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Which sign-in methods this deployment has configured. Social providers are
 * only enabled when their client id/secret pair is present in the environment;
 * email/password is always available.
 */
export type AuthProviders = {
  google: boolean
  github: boolean
}

export const NO_SOCIAL_PROVIDERS: AuthProviders = {
  google: false,
  github: false,
}

export type SocialProvider = keyof AuthProviders

export function hasAnySocialProvider(providers: AuthProviders): boolean {
  return providers.google || providers.github
}
