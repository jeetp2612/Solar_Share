/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * ON: SolarShare profiles use real email/password accounts (per-user wallets
 * live in this app's Postgres/PGLite DB). Build forms with
 * `authClient.signUp.email` / `authClient.signIn.email` from
 * `@/lib/auth/client`.
 */
export const emailAndPasswordEnabled = true;
