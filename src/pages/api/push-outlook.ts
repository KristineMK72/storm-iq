import type { APIRoute } from "astro";
import webpush from "web-push";

export const prerender = false;

const CHASE_RISKS = new Set(["MRGL", "SLGT", "ENH", "MDT", "HIGH"]);

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lng: number, lat: number, geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates || [];
    return rings.length > 0 && pointInRing(lng, lat, rings[0]);
  }
  if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates || []) {
      if (poly?.[0] && pointInRing(lng, lat, poly[0])) return true;
    }
  }
  return false;
}

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

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (process.env.PUSH_CRON_SECRET && secret !== process.env.PUSH_CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    return new Response(JSON.stringify({ error: "VAPID keys not set" }), { status: 500 });
  }

  webpush.setVapidDetails("mailto:kkahler190@gmail.com", pub, priv);

  const subs = await loadSubs();
  if (!subs.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no subscriptions" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const days = [
    { day: 1, url: "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.lyr.geojson" },
    { day: 2, url: "https://www.spc.noaa.gov/products/outlook/day2otlk_cat.lyr.geojson" },
  ];

  let sent = 0;
  const errors: string[] = [];

  for (const { day, url: outlookUrl } of days) {
    try {
      const res = await fetch(outlookUrl);
      if (!res.ok) continue;
      const data = await res.json();

      for (const sub of subs) {
        if (typeof sub.lat !== "number" || typeof sub.lng !== "number") continue;

        let best: any = null;
        const order = ["HIGH", "MDT", "ENH", "SLGT", "MRGL"];
        for (const f of data?.features || []) {
          const label = String(f.properties?.LABEL || "").toUpperCase();
          if (!CHASE_RISKS.has(label)) continue;
          if (!pointInGeometry(sub.lng, sub.lat, f.geometry)) continue;
          if (!best || order.indexOf(label) < order.indexOf(best.label)) {
            best = { label, label2: f.properties?.LABEL2 || label, issue: f.properties?.ISSUE };
          }
        }
        if (!best) continue;

        const tag = `spc-d${day}-${best.issue}-${best.label}`;
        const payload = JSON.stringify({
          title: `Day ${day} ${best.label} Risk`,
          body: `${best.label2} near home base — potential chase setup. Tap to open.`,
          url: "/forecast",
          tag,
        });

        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload
          );
          sent++;
        } catch (e: any) {
          errors.push(String(e?.message || e).slice(0, 120));
        }
      }
    } catch (e: any) {
      errors.push(String(e?.message || e).slice(0, 120));
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, subs: subs.length, errors: errors.slice(0, 5) }), {
    headers: { "Content-Type": "application/json" },
  });
};
