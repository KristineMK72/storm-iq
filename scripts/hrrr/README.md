# HRRR overlay renderer (Storm IQ)

Generates CONUS PNGs + `manifest.json` for map toggles **HRRR REFL** / **HRRR CAPE**.

See also: [`docs/HRRR_OVERLAY_API.md`](../../docs/HRRR_OVERLAY_API.md)

## No local bash? Use GitHub Actions

1. Open the repo on GitHub → **Actions**
2. Select workflow **HRRR overlays**
3. Click **Run workflow** (leave defaults or set forecast hour)
4. Wait for the green check (can take several minutes on first download)
5. Vercel should redeploy from the commit that updates `public/hrrr/`
6. Hard-refresh the map → enable **HRRR REFL** / **HRRR CAPE**

The workflow also runs every 3 hours (UTC). Disable the `schedule:` block in
`.github/workflows/hrrr-overlays.yml` if you want manual-only.

Artifacts are uploaded each run under the workflow summary (downloadable zip).

## Local setup (optional, when you have a terminal)

```bash
cd scripts/hrrr
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# macOS: brew install eccodes
# Ubuntu: sudo apt-get install libeccodes-dev
python render_hrrr_overlays.py
```

## Output

| File | Purpose |
|------|--------|
| `public/hrrr/refl.png` | Simulated composite reflectivity |
| `public/hrrr/cape.png` | CAPE field |
| `public/hrrr/manifest.json` | Valid time, bounds, layer URLs |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Workflow fails on Herbie/GRIB | Re-run; NOMADS can be briefly down |
| Empty layer URLs in manifest | Field search missed — try fxx=0 or 1; check logs |
| Actions minutes exhausted | Turn off `schedule` cron; run manually only |
| Map still says frames not published | Hard-refresh; confirm Vercel deployed the overlay commit |
| Huge repo growth | Later: host PNGs on S3/R2 instead of git |

## Attribution

NOAA HRRR + [Herbie](https://herbie.readthedocs.io/). Storm IQ labels overlays as model guidance only.
