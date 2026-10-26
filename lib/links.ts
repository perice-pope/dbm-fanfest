/** Social post link rules: only these hosts, https only, tracking stripped, host lowercased. */
const HOSTS: Record<string, { platform: string; strip: RegExp }> = {
  "instagram.com": { platform: "instagram", strip: /^(igsh|igshid|utm_.*)$/ },
  "tiktok.com": { platform: "tiktok", strip: /^(_t|_r|utm_.*)$/ },
  "vm.tiktok.com": { platform: "tiktok", strip: /^(_t|_r|utm_.*)$/ },
  "vt.tiktok.com": { platform: "tiktok", strip: /^(_t|_r|utm_.*)$/ },
  "facebook.com": { platform: "facebook", strip: /^(fbclid|utm_.*)$/ },
  "fb.watch": { platform: "facebook", strip: /^(fbclid|utm_.*)$/ },
  "fb.com": { platform: "facebook", strip: /^(fbclid|utm_.*)$/ },
};

export type LinkCheck =
  | { ok: true; platform: string; normalized: string; original: string }
  | { ok: false; reason: "invalid" | "not_https" | "host" };

export function normalizeSocialLink(input: string): LinkCheck {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "not_https" };
  let host = url.hostname.toLowerCase();
  host = host.replace(/^(www|m|mobile)\./, "");
  let rule = HOSTS[host];
  if (!rule) {
    const base = Object.keys(HOSTS).find((h) => host.endsWith("." + h));
    if (base) {
      rule = HOSTS[base];
      if (base === "instagram.com") host = base;
    }
  }
  if (!rule) return { ok: false, reason: "host" };
  const params = new URLSearchParams();
  for (const [k, v] of url.searchParams) if (!rule.strip.test(k)) params.append(k, v);
  const query = params.toString();
  const path = url.pathname.replace(/\/+$/, "");
  const normalized = `${host}${path}${query ? "?" + query : ""}`;
  return { ok: true, platform: rule.platform, normalized, original: url.toString() };
}
