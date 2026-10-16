import type { APIRoute } from "astro";

export const prerender = false;

type Sub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  lat?: number;
  lng?: number;
  created: number;
};

const KEY = "stormiq-push-subs";

async function loadSubs(): Promise<Sub[]> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import("@vercel/kv");
      const raw = await kv.get<Sub[]>(KEY);
      return Array.isArray(raw) ? raw : [];
    } catch {
      // fall through
    }
  }
  const g = globalThis as any;
  return g.__stormiqSubs || [];
}

async function saveSubs(subs: Sub[]) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set(KEY, subs);
      return;
    } catch {
      // fall through
    }
  }
  const g = globalThis as any;
  g.__stormiqSubs = subs;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return new Response(JSON.stringify({ error: "bad subscription" }), { status: 400 });
    }

    const entry: Sub = {
      endpoint: sub.endpoint,
      keys: sub.keys,
      lat: typeof body.lat === "number" ? body.lat : undefined,
      lng: typeof body.lng === "number" ? body.lng : undefined,
      created: Date.now(),
    };

    const subs = await loadSubs();
    const idx = subs.findIndex((s) => s.endpoint === entry.endpoint);
    if (idx >= 0) subs[idx] = entry;
    else subs.push(entry);

    await saveSubs(subs.slice(-200));

    return new Response(JSON.stringify({ ok: true, count: subs.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const GET: APIRoute = async () => {
  const subs = await loadSubs();
  return new Response(JSON.stringify({ count: subs.length }), {
    headers: { "Content-Type": "application/json" },
  });
};
