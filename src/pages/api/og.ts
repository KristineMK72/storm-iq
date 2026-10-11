/**
 * Dynamic Open Graph map preview.
 * Example: /api/og?lat=27&lng=-87.6&z=6
 * Returns a 1200×630 satellite basemap centered on the shared view.
 */
export const prerender = false;

function num(v: string | null, fallback: number): number {
  if (v == null || v === "") return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Geographic bbox from center + zoom for a 1200×630 image. */
function bboxFromView(lat: number, lng: number, zoom: number, w = 1200, h = 630) {
  const z = Math.max(3, Math.min(12, Math.round(zoom)));
  const cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const degPerPx = 360 / (256 * Math.pow(2, z));
  const halfW = (w / 2) * (degPerPx / cos);
  const halfH = (h / 2) * degPerPx;
  return {
    west: lng - halfW,
    south: lat - halfH,
    east: lng + halfW,
    north: lat + halfH,
  };
}

export async function GET({ url }: { url: URL }) {
  const lat = Math.max(-85, Math.min(85, num(url.searchParams.get("lat"), 39.5)));
  const lng = Math.max(-180, Math.min(180, num(url.searchParams.get("lng"), -98)));
  const z = num(url.searchParams.get("z"), 5);
  const b = bboxFromView(lat, lng, z);

  const esri =
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
    `?bbox=${b.west},${b.south},${b.east},${b.north}` +
    "&bboxSR=4326&imageSR=4326&size=1200,630&format=png&f=image&transparent=false";

  try {
    const res = await fetch(esri, {
      headers: { "User-Agent": "StormIQ/1.0 (map share preview)" },
    });
    if (!res.ok) {
      return new Response("Map preview unavailable", { status: 502 });
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=600, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Map preview error", { status: 500 });
  }
}
