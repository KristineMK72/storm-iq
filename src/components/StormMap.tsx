import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const demoTargets = [
  { name: "Eastern South Dakota", lat: 44.35, lng: -97.15, score: 86 },
  { name: "Central Nebraska",     lat: 41.25, lng: -99.75, score: 81 },
  { name: "Western Iowa",         lat: 42.05, lng: -95.45, score: 77 },
  { name: "Southern Minnesota",   lat: 43.95, lng: -94.55, score: 71 },
  { name: "Northern Kansas",      lat: 39.85, lng: -98.35, score: 68 },
];

export default function StormMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Centered on the contiguous United States
    const map = L.map(mapRef.current, {
      center: [39.8, -98.5],
      zoom: 4,
      zoomControl: true,
      minZoom: 3,
      maxZoom: 12,
    });

    // Free Esri dark gray basemap (no API key required)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community",
        maxZoom: 16,
      }
    ).addTo(map);

    demoTargets.forEach((t) => {
      const marker = L.circleMarker([t.lat, t.lng], {
        radius: 9,
        color: "#d9ff4a",
        fillColor: "#d9ff4a",
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(map);

      marker.bindPopup(
        `<strong>${t.name}</strong><br/>Demo score: <b>${t.score}</b>`
      );
    });

    mapInstance.current = map;

    // Fix size after the container becomes visible
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  return <div id="storm-map" ref={mapRef} />;
}
