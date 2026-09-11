# HRRR overlay renderer (Storm IQ)

Generates CONUS PNGs + `manifest.json` for the map toggles **HRRR REFL** / **HRRR CAPE**.

See also: [`docs/HRRR_OVERLAY_API.md`](../../docs/HRRR_OVERLAY_API.md)

## Setup

```bash
cd scripts/hrrr
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**System dependency:** [ecCodes](https://confluence.ecmwf.int/display/ECC) (for `cfgrib`)

- macOS: `brew install eccodes`
- Ubuntu: `sudo apt-get install libeccodes-dev`

## Run once

```bash
python render_hrrr_overlays.py
# writes to ../../public/hrrr by default
```

Options:

```bash
python render_hrrr_overlays.py --out /path/to/public/hrrr --fxx 2 --dpi 140
python render_hrrr_overlays.py --skip-cape   # reflectivity only
```

## Cron (hourly)

```cron
15 * * * * cd /path/to/storm-iq/scripts/hrrr && .venv/bin/python render_hrrr_overlays.py >> /tmp/hrrr-render.log 2>&1
```

Then deploy or sync `public/hrrr/` to your host (Vercel deploy, S3, rsync, etc.).

### GitHub Actions idea

1. Scheduled workflow hourly  
2. Run this script  
3. Commit `public/hrrr/*` or upload to object storage  
4. Vercel picks up the new static files on deploy  

For production, **object storage + CDN** is better than git-committing large PNGs every hour.

## Output

| File | Purpose |
|------|--------|
| `refl.png` | Simulated composite reflectivity |
| `cape.png` | CAPE field |
| `manifest.json` | Valid time, bounds, layer URLs |

Bounds are fixed to CONUS to match Storm IQ Leaflet overlays.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError: herbie` | `pip install herbie-data` |
| cfgrib / eccodes errors | Install system `eccodes` |
| Empty layers | Try `--fxx 0` or `1`; check NOMADS availability |
| Approximate map stretch | Lat/lon missing on field — upgrade Herbie/cfgrib or use cartopy transform |
| Huge downloads | Normal first run; Herbie caches under `~/data` |

## License / attribution

HRRR is a NOAA/NCEP product. Credit NOAA HRRR + Herbie in any public UI (Storm IQ already labels “model only”).
