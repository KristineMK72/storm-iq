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

    const map = L.map(mapRef.current, {
      center: [42.5, -97.5],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

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
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  return <div id="storm-map" ref={mapRef} />;
}
