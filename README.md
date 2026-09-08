# Storm IQ

**Live storm intelligence for safer storm observation.**

Storm IQ is a command dashboard that combines official National Weather Service alerts, SPC convective outlooks, national NEXRAD radar, and simple chase targeting tools — built for observers who want situational awareness without replacing official guidance.

**Live site:** [storm-iq.vercel.app](https://storm-iq.vercel.app)

---

## What it does

| Feature | Source |
|--------|--------|
| Active alerts & rankings | [api.weather.gov](https://www.weather.gov/documentation/services-web-api) |
| Day 1 categorical + tornado/hail probs | [SPC outlook GeoJSON](https://www.spc.noaa.gov/gis/) |
| Day 1–3 discussions & Day 4–8 link | SPC text products |
| National radar mosaic | [Iowa State Mesonet NEXRAD tiles](https://mesonet.agron.iastate.edu/) |
| Environment links (CAPE, shear, SRH) | [SPC Mesoanalysis](https://www.spc.noaa.gov/exper/mesoanalysis/) |
| Drive-time estimates | Home base (browser geolocation) + OSRM / distance model |

---

## Pages

- **Command** — dashboard, scores, map snapshot, model guidance, looking ahead
- **Map** — full operations map + multi-day SPC discussion
- **Targets** — ranked CONUS threats + home base / ETAs
- **Alerts** — filterable live NWS feed

---

## Safety

Storm IQ **does not replace** NWS warnings, local emergency management, or trained chase decision-making.

- If a warning conflicts with any target or route suggestion, **follow the official warning**.
- Routes are point-to-point only — they do **not** auto-avoid storm cores.
- Never drive into a tornado or flash-flood warning area to “get closer.”

---

## Stack

- [Astro](https://astro.build) + React islands
- Leaflet map
- Deployed on [Vercel](https://vercel.com)

```bash
npm install
npm run dev
```

---

## Disclaimer

Data is provided for informational and educational use. Always verify with official NWS / SPC products before making travel or safety decisions.
