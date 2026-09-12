var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/suite.ts
var TOOLS = "https://tools.ailab.gc.cuny.edu";
var secure = { "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" };
var json = /* @__PURE__ */ __name((body, status = 200) => Response.json(body, { status, headers: secure }), "json");
var random = /* @__PURE__ */ __name(() => btoa(String.fromCharCode(...Array.from(crypto.getRandomValues(new Uint8Array(32))))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""), "random");
var cookie = /* @__PURE__ */ __name((name, value, seconds) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`, "cookie");
var getCookie = /* @__PURE__ */ __name((r, n) => r.headers.get("cookie")?.split(";").map((s) => s.trim()).find((s) => s.startsWith(n + "="))?.slice(n.length + 1) || "", "getCookie");
var nextPath = /* @__PURE__ */ __name((s) => s && s.length < 500 && /^\/(?:\?|$|my-work(?:[/?#]|$))/.test(s) && !/[\\\r\n]/.test(s) ? s : "/", "nextPath");
var redirect = /* @__PURE__ */ __name((location, cookies = []) => {
  const h = new Headers({ ...secure, location });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status: 302, headers: h });
}, "redirect");
function accountRequest(request, path, identity, hub = false, body, method) {
  const url = new URL(TOOLS + path);
  if (!path.includes("?")) url.search = new URL(request.url).search;
  const headers = new Headers({ "x-cail-identity-jwt": hub ? identity.workspaceJwt : identity.appJwt });
  const verb = method || request.method;
  if (!["GET", "HEAD"].includes(verb)) {
    headers.set("origin", TOOLS);
    headers.set("content-type", "application/json");
  }
  return new Request(url, { method: verb, headers, body: body === void 0 ? verb === "GET" || verb === "HEAD" ? void 0 : request.body : JSON.stringify(body), signal: request.signal });
}
__name(accountRequest, "accountRequest");
async function boundedBody(request) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 2e5) throw new Error("Request too large");
  return JSON.parse(new TextDecoder().decode(bytes));
}
__name(boundedBody, "boundedBody");
async function suite(request, env, app) {
  const url = new URL(request.url), path = url.pathname, sessionName = "__Host-" + env.APP_ID + "-session", loginName = "__Host-" + env.APP_ID + "-login";
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && (request.headers.get("origin") !== env.PUBLIC_ORIGIN || request.headers.get("sec-fetch-site") === "cross-site")) return json({ error: { message: "Reload this page before continuing." } }, 403);
  try {
    if (path === "/auth/start") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      if (!(await env.REQUEST_LIMIT.limit({ key: "login:" + request.headers.get("cf-connecting-ip") })).success) return json({ error: "Try again shortly" }, 429);
      const verifier = random(), state = random(), digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      const challenge = btoa(String.fromCharCode(...Array.from(digest))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const result2 = await env.IDENTITY.begin(challenge, state), target = new URL(result2.url);
      if (target.origin !== TOOLS || target.pathname !== "/worker-login") throw new Error("Invalid login target");
      return redirect(result2.url, [cookie(loginName, encodeURIComponent(JSON.stringify({ verifier, state, next: nextPath(url.searchParams.get("next")) })), 600)]);
    }
    if (path === "/auth/callback") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const raw = getCookie(request, loginName);
      if (!raw || raw.length > 1500) return json({ error: "Login expired" }, 401);
      const pending = JSON.parse(decodeURIComponent(raw));
      if (!/^[A-Za-z0-9_-]{43}$/.test(pending.verifier) || !/^[A-Za-z0-9_-]{43}$/.test(pending.state) || pending.state !== url.searchParams.get("state")) return json({ error: "Login expired" }, 401);
      const result2 = await env.IDENTITY.redeem(url.searchParams.get("code") || "", pending.verifier);
      if (!result2.ok || !result2.token || !result2.expiresAt) return json({ error: "Login expired" }, result2.status || 401);
      return redirect(nextPath(pending.next), [cookie(sessionName, result2.token, Math.max(0, Math.floor((result2.expiresAt - Date.now()) / 1e3))), cookie(loginName, "", 0)]);
    }
    const token = getCookie(request, sessionName);
    if (path === "/auth/logout") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (token) await env.IDENTITY.revoke(token);
      return redirect("/", [cookie(sessionName, "", 0)]);
    }
    if (path === "/health") {
      await env.WORK_ACCOUNTS.register();
      return json({ ok: true, app: env.APP_ID, release: env.RELEASE, accounts: "cail-work-accounts" });
    }
    const requiresIdentity = path === "/api/session" || path === "/api/auth/me" || path.startsWith("/api/work/") || path.startsWith("/my-work") || url.searchParams.has("work");
    const result = token && requiresIdentity ? await env.IDENTITY.identities(token) : null;
    const identity = result?.ok ? result : null;
    if (result && !result.ok && result.status !== 401) return json({ error: { message: "CUNY access is temporarily unavailable." } }, result.status);
    if (path === "/api/config") return json({ model: env.CLOZE_MODEL, provider: "workers-ai", requiresLogin: false });
    if (path === "/api/session") return json({ authenticated: Boolean(identity) });
    if (path === "/api/auth/me") return identity ? json({ userId: 1, username: "CUNY" }) : json({ error: "CUNY Login required" }, 401);
    if (path.startsWith("/my-work") || url.searchParams.has("work")) {
      if (!identity) return redirect("/auth/start?next=" + encodeURIComponent(path + url.search));
      if (path.startsWith("/my-work")) return identity.workspaceJwt ? env.WORKSPACE.fetch(accountRequest(request, path, identity, true)) : json({ error: "CUNY access required" }, 403);
    }
    if (path.startsWith("/api/work/")) return identity ? env.WORK_ACCOUNTS.fetch(accountRequest(request, path, identity)) : json({ error: { message: "CUNY Login required" } }, 401);
    if (path === "/api/ai/chat") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (!(await env.REQUEST_LIMIT.limit({ key: "ai:" + request.headers.get("cf-connecting-ip") })).success) return json({ error: "Try again shortly" }, 429);
      let body;
      try {
        body = await boundedBody(request);
      } catch {
        return json({ error: { message: "Invalid JSON request" } }, 400);
      }
      if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 300 || body.messages.some((m) => !m || !["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string"))
        return json({ error: { message: "Invalid model request" } }, 400);
      if (body.stream === true) return json({ error: { message: "Use a complete response for this exercise." } }, 400);
      const maxTokens = body.max_tokens ?? 800, temperature = body.temperature ?? 0.7;
      if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 2048 || typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2)
        return json({ error: { message: "Invalid generation settings" } }, 400);
      const result2 = await env.AI.run(env.CLOZE_MODEL, {
        messages: body.messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
        chat_template_kwargs: { enable_thinking: false }
      });
      const content = result2?.choices?.[0]?.message?.content ?? result2?.response;
      if (typeof content !== "string" || !content.trim()) return json({ error: { message: "The model returned an empty response." } }, 502);
      return json({ model: env.CLOZE_MODEL, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: result2?.choices?.[0]?.finish_reason ?? "stop" }], ...result2?.usage ? { usage: result2.usage } : {} });
    }
    return await app(request, identity);
  } catch {
    return json({ error: { message: "The service is temporarily unavailable. Please retry." } }, 503);
  }
}
__name(suite, "suite");

// worker/index.ts
var index_default = { fetch(request, env) {
  return suite(request, env, async (req) => {
    const url = new URL(req.url), path = url.pathname;
    const allowed = req.method === "GET" && /^\/api\/(?:books\/(?:rows|splits)|leaderboard|health)$/.test(path) || req.method === "POST" && ["/api/leaderboard/add", "/api/analytics/passage"].includes(path);
    if (allowed) {
      const headers = new Headers();
      if (req.headers.has("content-type")) headers.set("content-type", req.headers.get("content-type"));
      const upstream = await fetch(env.LEGACY_ORIGIN + path + url.search, { method: req.method, headers, body: req.method === "GET" ? void 0 : req.body, signal: req.signal });
      if (path === "/api/leaderboard" && upstream.ok) {
        const data = await upstream.json();
        const old = await env.LEGACY_DB.prepare("SELECT initials,level,round,passages_passed,date FROM leaderboard ORDER BY level DESC,round DESC LIMIT 100").all();
        const rows = [...data.leaderboard || [], ...old.results];
        const seen = /* @__PURE__ */ new Set();
        data.leaderboard = rows.filter((r) => {
          const key = JSON.stringify([r.initials, r.level, r.round, r.date]);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).sort((a, b) => b.level - a.level || b.round - a.round).slice(0, 100);
        return json(data);
      }
      return new Response(upstream.body, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "no-store" } });
    }
    if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(req);
  });
} };
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
