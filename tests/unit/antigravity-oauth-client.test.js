// Guards the deduped OAuth client wiring: every source resolves to the SAME
// credential object, and no tracked file hardcodes a Google OAuth client secret.
// Values live in .env (gitignored) — never in this file.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), "utf8");

// A hardcoded Google OAuth client secret in a tracked file is published on push.
const SECRET_LITERAL = /GOCSPX-[A-Za-z0-9_-]{10,}/;

describe("antigravity oauth client (deduped)", () => {
  it("shared source exposes the client shape from env", async () => {
    const { ANTIGRAVITY_OAUTH_CLIENT } = await import("../../open-sse/providers/shared.js");
    expect(Object.keys(ANTIGRAVITY_OAUTH_CLIENT).sort()).toEqual(["clientId", "clientSecret"]);
  });

  it("registry transport keeps clientId/clientSecret identical to shared", async () => {
    const { ANTIGRAVITY_OAUTH_CLIENT } = await import("../../open-sse/providers/shared.js");
    const ag = (await import("../../open-sse/providers/registry/antigravity.js")).default;
    expect(ag.transport.clientId).toBe(ANTIGRAVITY_OAUTH_CLIENT.clientId);
    expect(ag.transport.clientSecret).toBe(ANTIGRAVITY_OAUTH_CLIENT.clientSecret);
  });

  it("google client shared by gemini + gemini-cli", async () => {
    const { GOOGLE_OAUTH_CLIENT } = await import("../../open-sse/providers/shared.js");
    const gemini = (await import("../../open-sse/providers/registry/gemini.js")).default;
    const gc = (await import("../../open-sse/providers/registry/gemini-cli.js")).default;
    expect(gemini.transport.clientId).toBe(GOOGLE_OAUTH_CLIENT.clientId);
    expect(gemini.transport.clientSecret).toBe(GOOGLE_OAUTH_CLIENT.clientSecret);
    expect(gc.transport.clientId).toBe(GOOGLE_OAUTH_CLIENT.clientId);
    expect(gc.transport.clientSecret).toBe(GOOGLE_OAUTH_CLIENT.clientSecret);
  });

  // Guard: oauth.js must spread shared clients + derive from registry (PROVIDER_OAUTH).
  it("src oauth.js imports shared client + keeps full shape", () => {
    const src = read("../../src/lib/oauth/constants/oauth.js");
    expect(src).toContain(
      'import { ANTIGRAVITY_OAUTH_CLIENT, GOOGLE_OAUTH_CLIENT, WINDSURF_FIREBASE_API_KEY } from "open-sse/providers/shared.js"'
    );
    expect(src).toContain("...ANTIGRAVITY_OAUTH_CLIENT");
    expect(src).toContain("...GOOGLE_OAUTH_CLIENT");
    expect(src).toContain('PROVIDER_OAUTH["antigravity"]');
    expect(src).toContain('PROVIDER_OAUTH["gemini-cli"]');
  });

  it("no tracked source hardcodes an oauth client secret", () => {
    const files = [
      "../../open-sse/providers/shared.js",
      "../../open-sse/providers/registry/antigravity.js",
      "../../open-sse/providers/registry/gemini.js",
      "../../open-sse/providers/registry/gemini-cli.js",
      "../../open-sse/providers/registry/windsurf.js",
      "../../src/lib/oauth/constants/oauth.js",
    ];
    for (const rel of files) {
      expect(SECRET_LITERAL.test(read(rel))).toBe(false);
    }
  });
});
