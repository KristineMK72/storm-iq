#!/usr/bin/env python3
"""
Storm IQ — HRRR map overlay renderer

Pulls recent HRRR fields, renders CONUS PNGs, writes manifest.json
for Leaflet imageOverlay (see docs/HRRR_OVERLAY_API.md).

Usage:
  python render_hrrr_overlays.py
  python render_hrrr_overlays.py --out ../../public/hrrr --fxx 1
  python render_hrrr_overlays.py --model hrrr --product sfc

Requires: pip install -r requirements.txt
System: eccodes (for cfgrib) — on macOS: brew install eccodes

Note: First Herbie downloads can be large. Needs network + disk cache.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# CONUS geographic bounds — must match Storm IQ Leaflet overlay
# [[south, west], [north, east]]
BOUNDS_LATLON = [[24.2, -125.0], [49.5, -66.5]]
EXTENT = [-125.0, -66.5, 24.2, 49.5]  # west, east, south, north for imshow


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Render HRRR overlays for Storm IQ")
    p.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "public" / "hrrr",
        help="Output directory for PNGs + manifest.json",
    )
    p.add_argument("--fxx", type=int, default=1, help="Forecast hour (default 1)")
    p.add_argument(
        "--model",
        default="hrrr",
        help="Herbie model name (default hrrr)",
    )
    p.add_argument(
        "--product",
        default="sfc",
        help="Herbie product (sfc recommended)",
    )
    p.add_argument(
        "--dpi",
        type=int,
        default=120,
        help="Figure DPI (higher = larger PNG)",
    )
    p.add_argument(
        "--skip-cape",
        action="store_true",
        help="Only render simulated reflectivity",
    )
    p.add_argument(
        "--skip-refl",
        action="store_true",
        help="Only render CAPE",
    )
    return p.parse_args()


def ensure_deps():
    missing = []
    for mod in ("herbie", "xarray", "matplotlib", "numpy"):
        try:
            __import__(mod if mod != "herbie" else "herbie")
        except ImportError:
            missing.append(mod if mod != "herbie" else "herbie-data")
    if missing:
        print("Missing packages:", ", ".join(missing), file=sys.stderr)
        print("Run: pip install -r requirements.txt", file=sys.stderr)
        sys.exit(1)


def open_hrrr(model: str, product: str, fxx: int):
    from herbie import Herbie

    H = Herbie("now", model=model, product=product, fxx=fxx)
    print(f"Herbie: model={model} product={product} fxx={fxx}")
    print(f"  date={H.date}  remote={getattr(H, 'grib', None) or getattr(H, 'SOURCES', '')}")
    return H


def load_field(H, search: str):
    """Return xarray DataArray for first matching GRIB field."""
    ds = H.xarray(search)
    # Herbie sometimes returns Dataset or list
    if isinstance(ds, list):
        ds = ds[0]
    if hasattr(ds, "data_vars"):
        # pick first data var
        name = list(ds.data_vars)[0]
        da = ds[name]
    else:
        da = ds
    return da


def field_to_latlon_grid(da):
    """
    Best-effort extract 2D values + lat/lon.
    HRRR is usually Lambert; Herbie/cfgrib may expose latitude/longitude coords.
    """
    import numpy as np

    vals = np.asarray(da.values, dtype=float)
    if vals.ndim > 2:
        vals = vals.reshape(vals.shape[-2], vals.shape[-1])

    lat = None
    lon = None
    for key in ("latitude", "lat"):
        if key in da.coords:
            lat = np.asarray(da.coords[key].values, dtype=float)
            break
    for key in ("longitude", "lon"):
        if key in da.coords:
            lon = np.asarray(da.coords[key].values, dtype=float)
            break

    if lat is None or lon is None:
        # Some cfgrib layouts nest under different names
        for c in da.coords:
            cl = c.lower()
            if "lat" in cl and lat is None:
                lat = np.asarray(da.coords[c].values, dtype=float)
            if "lon" in cl and lon is None:
                lon = np.asarray(da.coords[c].values, dtype=float)

    if lon is not None:
        lon = np.where(lon > 180, lon - 360, lon)

    return vals, lat, lon


def render_conus_png(
    vals,
    lat,
    lon,
    out_path: Path,
    *,
    vmin,
    vmax,
    cmap: str,
    dpi: int,
    title: str,
):
    import numpy as np
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import Normalize

    out_path.parent.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(12, 7), dpi=dpi)
    ax.set_xlim(EXTENT[0], EXTENT[1])
    ax.set_ylim(EXTENT[2], EXTENT[3])
    ax.set_aspect("equal")
    ax.axis("off")
    fig.patch.set_alpha(0.0)
    ax.patch.set_alpha(0.0)

    norm = Normalize(vmin=vmin, vmax=vmax)

    if lat is not None and lon is not None and lat.shape == vals.shape and lon.shape == vals.shape:
        # Scatter/pcolormesh with native lat/lon
        mesh = ax.pcolormesh(
            lon,
            lat,
            vals,
            shading="auto",
            cmap=cmap,
            norm=norm,
            alpha=0.85,
        )
    else:
        # Fallback: stretch array across CONUS extent (approximate)
        print("  warning: no lat/lon coords — using extent stretch (approximate)")
        mesh = ax.imshow(
            vals,
            origin="upper",
            extent=EXTENT,
            cmap=cmap,
            norm=norm,
            alpha=0.85,
            aspect="auto",
        )

    # Transparent below useful signal for refl-like fields
    if cmap in ("gist_ncar", "NWSRef", "turbo"):
        # leave as-is; user can tune
        pass

    plt.savefig(
        out_path,
        dpi=dpi,
        bbox_inches="tight",
        pad_inches=0,
        transparent=True,
        facecolor="none",
    )
    plt.close(fig)
    print(f"  wrote {out_path} ({out_path.stat().st_size // 1024} KB)")


def iso_z(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> int:
    args = parse_args()
    ensure_deps()

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    try:
        H = open_hrrr(args.model, args.product, args.fxx)
    except Exception as e:
        print(f"Failed to init Herbie: {e}", file=sys.stderr)
        print("Check network and: pip install herbie-data cfgrib xarray", file=sys.stderr)
        return 1

    # Valid time ≈ run + fxx hours
    run_date = H.date
    if hasattr(run_date, "to_pydatetime"):
        run_date = run_date.to_pydatetime()
    if not isinstance(run_date, datetime):
        run_date = datetime.utcnow()
    from datetime import timedelta

    valid = run_date + timedelta(hours=args.fxx)

    layers = {}
    note_parts = []

    # --- Simulated composite / reflectivity ---
    if not args.skip_refl:
        refl_ok = False
        for search in (
            ":REFC:",  # composite reflectivity
            ":REFD:1000",
            ":REF",
        ):
            try:
                print(f"Loading refl search {search!r}...")
                da = load_field(H, search)
                vals, lat, lon = field_to_latlon_grid(da)
                path = out / "refl.png"
                render_conus_png(
                    vals,
                    lat,
                    lon,
                    path,
                    vmin=0,
                    vmax=75,
                    cmap="gist_ncar",
                    dpi=args.dpi,
                    title="HRRR REFC",
                )
                layers["refl"] = {
                    "url": "/hrrr/refl.png",
                    "opacity": 0.55,
                    "label": "Simulated reflectivity",
                }
                refl_ok = True
                break
            except Exception as e:
                print(f"  refl search failed: {e}")
        if not refl_ok:
            note_parts.append("refl unavailable this run")

    # --- CAPE ---
    if not args.skip_cape:
        cape_ok = False
        for search in (
            ":CAPE:surface",
            ":CAPE:90-0 mb above ground",
            ":CAPE:",
        ):
            try:
                print(f"Loading CAPE search {search!r}...")
                da = load_field(H, search)
                vals, lat, lon = field_to_latlon_grid(da)
                path = out / "cape.png"
                render_conus_png(
                    vals,
                    lat,
                    lon,
                    path,
                    vmin=0,
                    vmax=4000,
                    cmap="turbo",
                    dpi=args.dpi,
                    title="HRRR CAPE",
                )
                layers["cape"] = {
                    "url": "/hrrr/cape.png",
                    "opacity": 0.45,
                    "label": "Surface/mixed CAPE",
                }
                cape_ok = True
                break
            except Exception as e:
                print(f"  CAPE search failed: {e}")
        if not cape_ok:
            note_parts.append("cape unavailable this run")

    # Keep empty layer stubs so the client always has keys
    if "refl" not in layers:
        layers["refl"] = {"url": "", "opacity": 0.55, "label": "Simulated reflectivity"}
    if "cape" not in layers:
        layers["cape"] = {"url": "", "opacity": 0.45, "label": "MLCAPE"}

    manifest = {
        "updated": iso_z(datetime.now(timezone.utc)),
        "valid": iso_z(valid),
        "model": "HRRR",
        "run": run_date.strftime("%Y%m%d_%H") if isinstance(run_date, datetime) else None,
        "forecastHour": args.fxx,
        "bounds": BOUNDS_LATLON,
        "layers": layers,
        "note": (
            "; ".join(note_parts)
            if note_parts
            else "Model guidance only — not observations or NWS warnings."
        ),
    }

    man_path = out / "manifest.json"
    man_path.write_text(json.dumps(manifest, indent=2))
    print(f"wrote {man_path}")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
