import type { APIRoute } from "astro";
import webpush from "web-push";

export const prerender = false;

async function loadSubs(): Promise<any[]> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import("@vercel/kv");
      const raw = await kv.get("stormiq-push-subs");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }
  const g = globalThis as any;
  return g.__stormiqSubs || [];
}

export const POST: APIRoute = async ({ request }) => {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    return new Response(
      JSON.stringify({ error: "VAPID keys not set in Vercel env" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  webpush.setVapidDetails("mailto:kkahler190@gmail.com", pub, priv);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // ignore
  }

  const subs = await loadSubs();
  let target = body?.subscription;
  if (!target?.endpoint && subs.length) {
    target = subs[subs.length - 1];
  }

  if (!target?.endpoint || !target?.keys) {
    return new Response(
      JSON.stringify({ error: "No subscription found. Enable alerts first." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = JSON.stringify({
    title: "Storm IQ · Test",
    body: "Background push is working. You'll get real Day 1/2 outlook alerts here.",
    url: "/map",
    tag: "stormiq-test-" + Date.now(),
  });

  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: target.keys },
      payload
    );
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
