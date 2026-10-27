/** Redirect targets and route params that come from the request are never trusted as-is. */
export function isSlug(s: string | null | undefined): s is string {
  return !!s && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(s);
}

export function isUuid(s: string | null | undefined): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Same-origin absolute path only: no `//host`, no `/\host`, nothing that resolves off this origin. */
export function safeNext(slug: string, next: string | null | undefined, origin: string): string {
  const fallback = `/${isSlug(slug) ? slug : "destroyedbymoths"}`;
  if (!next || !/^\/(?![/\\])/.test(next)) return fallback;
  try {
    return new URL(next, origin).origin === origin ? next : fallback;
  } catch {
    return fallback;
  }
}

export function slugFromPath(path: string, fallback = "destroyedbymoths"): string {
  const seg = path.split("?")[0].split("/")[1];
  return isSlug(seg) ? seg : fallback;
}
