/** JWT is stored in sessionStorage as `access_token` (see AuthContext). */
export function resolveAccessToken(ctxToken: string | null | undefined): string | null {
  const fromCtx = ctxToken?.trim();
  if (fromCtx) return fromCtx;
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("access_token")?.trim() || null;
}
