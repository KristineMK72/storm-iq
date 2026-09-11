# HRRR map overlay API (Storm IQ)

Storm IQ’s map can show HRRR (or HRRR-like) fields as **georeferenced image overlays**.
The browser does not decode GRIB. A small renderer (cron + Python) writes PNGs and a manifest.

## Manifest

**URL (client):** `/hrrr/manifest.json` (or set `window.__STORMIQ_HRRR_MANIFEST__`)

```json
{
  "updated": "2026-09-11T22:00:00Z",
  "valid": "2026-09-11T21:00:00Z",
  "model": "HRRR",
  "run": "20260911_18",
  "forecastHour": 3,
  "bounds": [
    [24.2, -125.0],
    [49.5, -66.5]
  ],
  "layers": {
    "refl": {
      "url": "/hrrr/refl.png",
      "opacity": 0.55,
      "label": "Simulated reflectivity"
    },
    "cape": {
      "url": "/hrrr/cape.png",
      "opacity": 0.45,
      "label": "MLCAPE"
    }
  },
  "note": "Model guidance only — not observations or NWS warnings."
}
```

### Field notes

| Field | Required | Meaning |
|-------|----------|--------|
| `valid` | yes | Model valid time (ISO UTC) |
| `bounds` | yes | `[[south, west], [north, east]]` for Leaflet `imageOverlay` |
| `layers.*.url` | yes | Absolute or site-relative PNG (CORS-friendly if external) |
| `layers.*.opacity` | no | Default 0.5 |

## Renderer outline (server / cron)

1. Download latest HRRR from NOMADS or AWS Open Data.
2. Extract field (e.g. simulated reflectivity, MLCAPE) with `wgrib2` / `herbie` / `cfgrib`.
3. Render CONUS PNG with known geographic bounds (same as `bounds`).
4. Upload `refl.png`, `cape.png`, `manifest.json` to `/public/hrrr/` or object storage.
5. Run each HRRR cycle (~hourly).

### Example tools

- [Herbie](https://herbie.readthedocs.io/) — fetch HRRR
- `matplotlib` + `cartopy` or `pygrib` — render
- GitHub Actions / Fly.io cron — schedule

## Leaflet usage (already in StormMap)

```js
L.imageOverlay(url, bounds, { opacity, zIndex: 250 })
```

Toggles: **HRRR REFL** · **HRRR CAPE**

## Limits

- Overlays are pictures, not queryable grids (use Model timeline for point values).
- Keep PNG sizes reasonable for mobile (~1–3 MB).
- Always show **valid time** and “model only” disclaimer.
