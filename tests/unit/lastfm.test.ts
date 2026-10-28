import { describe, it, expect, beforeAll } from "vitest";
import { sign } from "@/lib/lastfm";

beforeAll(() => { process.env.LASTFM_API_KEY = "key"; process.env.LASTFM_SHARED_SECRET = "secret"; });

describe("Last.fm api_sig", () => {
  it("sorts parameters, joins name+value, appends the secret and md5s it, ignoring format", () => {
    // md5("api_keykeymethodauth.getSessiontokenabcsecret")
    expect(sign({ method: "auth.getSession", token: "abc", api_key: "key", format: "json" })).toBe("6629efc98b97f7c35ff32314185ffaa1");
  });
});
