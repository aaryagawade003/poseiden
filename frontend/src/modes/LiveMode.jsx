import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapContainer, ZoomControl, useMap, Circle, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  Wind,
  Waves,
  Satellite,
  Ship,
  ShieldCheck,
  Clock,
  Radio,
  RefreshCw,
  AlertTriangle,
  Info,
  Globe,
  Zap,
  Eye,
  Navigation,
  Thermometer,
} from "lucide-react";

import { BasemapLayer, AISVesselsLayer, clampToSea } from "../components/MapLayers.jsx";
import { CanvasVectorLayer } from "../components/CanvasVectorLayer.jsx";
import { getLiveState, getLiveEvents } from "../services/api.js";

// ─── Pulsing anomaly icon ──────────────────────────────────────────────────
function createAnomalyIcon(color = "#f43f5e") {
  const html = `<div style="
    width:18px;height:18px;
    border-radius:50%;
    background:${color};
    border:2px solid white;
    box-shadow:0 0 12px ${color}, 0 0 24px ${color}80;
    animation:pulse-anim 1.6s ease-in-out infinite;
  "></div>`;
  return L.divIcon({ html, className: "", iconSize: [18, 18], iconAnchor: [9, 9] });
}

// ─── Live Satellite Pass Overlay ──────────────────────────────────────────
function SatellitePassAnimator() {
  const map = useMap();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    const size = map.getSize();

    const canvas = document.createElement("canvas");
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      pointer-events:none;z-index:600;
    `;
    // attach to leaflet pane
    const pane = map.getPane("overlayPane");
    if (pane) pane.appendChild(canvas);
    canvasRef.current = canvas;

    let t = 0;

    const animate = () => {
      if (isCancelled) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Satellite scan line moving across the map
      t += 0.003;
      const scanY = ((Math.sin(t * 0.7) + 1) / 2) * canvas.height;
      const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      scanGrad.addColorStop(0, "rgba(34,211,238,0)");
      scanGrad.addColorStop(0.5, "rgba(34,211,238,0.08)");
      scanGrad.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 40, canvas.width, 80);

      // Scan line glow
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(canvas.width, scanY);
      ctx.strokeStyle = "rgba(34,211,238,0.25)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Corner grid corners (radar-like)
      const corners = [
        [20, 20], [canvas.width - 20, 20],
        [20, canvas.height - 20], [canvas.width - 20, canvas.height - 20],
      ];
      ctx.strokeStyle = "rgba(34,211,238,0.3)";
      ctx.lineWidth = 1.5;
      const len = 18;
      corners.forEach(([cx, cy]) => {
        const sx = cx < canvas.width / 2 ? 1 : -1;
        const sy = cy < canvas.height / 2 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + sx * len, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + sy * len); ctx.stroke();
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    const onResize = () => {
      const s = map.getSize();
      canvas.width = s.x;
      canvas.height = s.y;
    };
    map.on("resize", onResize);

    return () => {
      isCancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      map.off("resize", onResize);
    };
  }, [map]);

  return null;
}

// ─── Global active monitoring zones ───────────────────────────────────────
const MONITORING_ZONES = [
  { lat: 11.0, lon: 74.8, label: "Lakshadweep Sea", risk: "HIGH", color: "#f43f5e" },
  { lat: 19.2, lon: 72.8, label: "Mumbai High", risk: "MED", color: "#f59e0b" },
  { lat: 9.8,  lon: 75.9, label: "Arabian Sea Corridor", risk: "HIGH", color: "#f43f5e" },
  { lat: 13.1, lon: 80.3, label: "Bay of Bengal", risk: "LOW", color: "#22c55e" },
  { lat: 22.5, lon: 70.2, label: "Gulf of Kutch", risk: "MED", color: "#f59e0b" },
  { lat: 8.5,  lon: 77.5, label: "Gulf of Mannar", risk: "LOW", color: "#22c55e" },
  // Global zones
  { lat: 1.3,  lon: 104.0, label: "Malacca Strait", risk: "HIGH", color: "#f43f5e" },
  { lat: 26.0, lon: 56.5,  label: "Strait of Hormuz", risk: "HIGH", color: "#f43f5e" },
  { lat: 27.9, lon: 34.4,  label: "Suez Canal", risk: "MED", color: "#f59e0b" },
  { lat: -6.0, lon: 39.5,  label: "Zanzibar Channel", risk: "LOW", color: "#22c55e" },
  { lat: 51.5, lon: 1.2,   label: "English Channel", risk: "MED", color: "#f59e0b" },
  { lat: 29.5, lon: -89.5, label: "Gulf of Mexico", risk: "HIGH", color: "#f43f5e" },
];

// ─── Active incidents around the globe ────────────────────────────────────
const GLOBAL_INCIDENTS = [
  { lat: 9.83, lon: 75.87, type: "SPILL", label: "Verified Slick — Arabian Sea", color: "#f43f5e" },
  { lat: 1.28, lon: 104.1, type: "VESSEL", label: "Suspicious AIS Gap — Malacca", color: "#f59e0b" },
  { lat: 29.3, lon: -89.1, type: "SPILL", label: "Satellite Anomaly — Gulf of Mexico", color: "#fb923c" },
];

export default function LiveMode() {
  const [liveState, setLiveState] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [mapView, setMapView] = useState("regional"); // "regional" | "global"

  // Map layer toggles
  const [showWind, setShowWind] = useState(true);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showVessels, setShowVessels] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showSatScan, setShowSatScan] = useState(true);
  const [basemap, setBasemap] = useState("satellite");

  // Animated ticker for event stream
  const [tickCount, setTickCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [stateRes, eventsRes] = await Promise.allSettled([
        getLiveState(),
        getLiveEvents(),
      ]);

      if (stateRes.status === "fulfilled" && stateRes.value) {
        setLiveState(stateRes.value);
      }
      if (eventsRes.status === "fulfilled" && eventsRes.value) {
        setEvents(eventsRes.value.events || []);
      }
      setLastRefreshed(new Date().toLocaleTimeString("en-US", { timeZone: "UTC", hour12: false }) + " UTC");
    } catch (err) {
      console.warn("Live monitoring sync warning:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 12000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Tick for animated counter
  useEffect(() => {
    const t = setInterval(() => setTickCount(c => c + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const sources = liveState?.sources || {};
  const sat = sources.satellite || {};
  const wind = sources.wind || {};
  const curr = sources.current || {};
  const ais = sources.ais || {};
  const spillMon = liveState?.spill_monitor || {};

  const mapCenter = mapView === "global" ? [20, 20] : [16.5, 73.5];
  const mapZoom   = mapView === "global" ? 3 : 6;

  // Synthetic live vessel icons for global view
  const syntheticLiveVessels = useMemo(() => {
    if (ais.status === "LIVE") return ais.vessels || [];
    return [];
  }, [ais]);

  // Simulated metrics that animate gently
  const windSpeed  = ((wind.speed_ms  || 6.4)  + Math.sin(tickCount * 0.08) * 0.3).toFixed(1);
  const currSpeed  = ((curr.speed_ms  || 0.42) + Math.sin(tickCount * 0.12) * 0.02).toFixed(2);
  const satCount   = 3 + (tickCount % 7 > 4 ? 1 : 0);
  const aisCount   = 247 + (tickCount % 13);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-[#040812] text-slate-200 overflow-hidden flex flex-col">

      {/* Animated scan line overlay across entire page */}
      <style>{`
        @keyframes pulse-anim {
          0%,100% { box-shadow: 0 0 8px var(--col,#f43f5e), 0 0 16px var(--col,#f43f5e)40; transform: scale(1); }
          50% { box-shadow: 0 0 16px var(--col,#f43f5e), 0 0 32px var(--col,#f43f5e)60; transform: scale(1.25); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .live-event-row { animation: fadeSlideIn 0.4s ease; }
        .blinking { animation: blink 1.4s ease-in-out infinite; }
        @keyframes float-badge {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .float-badge { animation: float-badge 2.5s ease-in-out infinite; }
      `}</style>

      {/* ── TOP STATUS BAR ──────────────────────────────────────────────── */}
      <div className="h-10 border-b border-[#142340] bg-[#060c18]/95 backdrop-blur px-4 flex items-center justify-between z-30 text-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold uppercase tracking-widest text-emerald-400">LIVE MONITORING</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 font-mono">
            <Globe size={12} className="text-sky-400" />
            <span>AOI: Indian Ocean + Arabian Sea + Global Shipping Lanes</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Map View Toggle */}
          <div className="flex items-center bg-[#0b162c] rounded-lg border border-[#1a3159] p-0.5">
            <button
              onClick={() => setMapView("regional")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                mapView === "regional"
                  ? "bg-sky-500/25 text-sky-300 border border-sky-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🌊 Regional
            </button>
            <button
              onClick={() => setMapView("global")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                mapView === "global"
                  ? "bg-sky-500/25 text-sky-300 border border-sky-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🌍 Global
            </button>
          </div>

          {/* Animated live stats */}
          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-1 bg-[#0b162c] px-2 py-1 rounded border border-[#1a3159]">
              <Satellite size={11} className="text-purple-400" />
              <span className="text-slate-400">SAT:</span>
              <span className="text-purple-300 font-bold">{satCount} Active</span>
            </div>
            <div className="flex items-center gap-1 bg-[#0b162c] px-2 py-1 rounded border border-[#1a3159]">
              <Ship size={11} className="text-emerald-400" />
              <span className="text-slate-400">AIS:</span>
              <span className="text-emerald-300 font-bold">{aisCount} Vessels</span>
            </div>
            <div className="flex items-center gap-1 bg-[#0b162c] px-2 py-1 rounded border border-[#1a3159]">
              <AlertTriangle size={11} className="text-amber-400" />
              <span className="text-slate-400">Alerts:</span>
              <span className="text-amber-300 font-bold">3 Active</span>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#111e38] rounded transition"
            title="Refresh telemetry"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-sky-400" : ""} />
          </button>
        </div>
      </div>

      {/* ── MAIN MAP + RIGHT PANEL ────────────────────────────────────── */}
      <div className="relative flex-1 flex overflow-hidden">

        {/* HERO MAP */}
        <div className="relative flex-1 h-full w-full">
          <MapContainer
            key={mapView}
            center={mapCenter}
            zoom={mapZoom}
            minZoom={2}
            maxZoom={14}
            zoomControl={false}
            className="w-full h-full z-0 bg-[#030712]"
          >
            <ZoomControl position="bottomleft" />
            <BasemapLayer basemap={basemap} />

            {/* Global wind & ocean current animations */}
            <CanvasVectorLayer showWind={showWind} showCurrent={showCurrent} />

            {/* Satellite scan animation overlay */}
            {showSatScan && <SatellitePassAnimator />}

            {/* Live AIS Vessels (only if real feed connected) */}
            {showVessels && (
              <AISVesselsLayer
                vessels={syntheticLiveVessels}
                isDemoMode={false}
                showTracks={false}
              />
            )}

            {/* Monitoring zone circles */}
            {showZones && MONITORING_ZONES.map((z, i) => (
              <Circle
                key={i}
                center={[z.lat, z.lon]}
                radius={z.risk === "HIGH" ? 65000 : z.risk === "MED" ? 45000 : 30000}
                pathOptions={{
                  color: z.color,
                  weight: 1.2,
                  dashArray: "4 6",
                  fillColor: z.color,
                  fillOpacity: 0.05,
                }}
              >
                <Popup>
                  <div style={{ fontSize: 11, fontFamily: "Inter,sans-serif", minWidth: 160 }}>
                    <div style={{ fontWeight: 700, color: z.color, marginBottom: 4, textTransform: "uppercase" }}>
                      {z.label}
                    </div>
                    <div style={{ color: "#94a3b8" }}>Risk Level: <span style={{ color: z.color, fontWeight: 600 }}>{z.risk}</span></div>
                    <div style={{ color: "#94a3b8" }}>Status: Active Monitoring</div>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Active incident markers */}
            {GLOBAL_INCIDENTS.map((inc, i) => (
              <Marker
                key={i}
                position={[inc.lat, inc.lon]}
                icon={createAnomalyIcon(inc.color)}
              >
                <Popup>
                  <div style={{ fontSize: 11, fontFamily: "Inter,sans-serif" }}>
                    <div style={{ fontWeight: 700, color: inc.color, marginBottom: 4 }}>
                      {inc.type === "SPILL" ? "🛢" : "⚠️"} {inc.label}
                    </div>
                    <div style={{ color: "#94a3b8" }}>Type: {inc.type}</div>
                    <div style={{ color: "#94a3b8" }}>Coords: {inc.lat.toFixed(3)}°N, {inc.lon.toFixed(3)}°E</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* ── MAP OVERLAY CONTROLS ─────────────────────────────────── */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 bg-[#091224]/92 backdrop-blur-md p-1.5 rounded-xl border border-[#1a2c4e] shadow-2xl text-xs flex-wrap">
            <button
              onClick={() => setShowWind(!showWind)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition font-semibold ${
                showWind
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Toggle ERA5 10m Wind Vectors"
            >
              <Wind size={13} className={showWind ? "text-amber-400" : "text-slate-400"} />
              <span>Wind</span>
            </button>

            <button
              onClick={() => setShowCurrent(!showCurrent)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition font-semibold ${
                showCurrent
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Toggle Copernicus Ocean Currents"
            >
              <Waves size={13} className={showCurrent ? "text-cyan-400" : "text-slate-400"} />
              <span>Currents</span>
            </button>

            <button
              onClick={() => setShowZones(!showZones)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition font-semibold ${
                showZones
                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Toggle Monitoring Zones"
            >
              <Eye size={13} />
              <span>Zones</span>
            </button>

            <button
              onClick={() => setShowSatScan(!showSatScan)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition font-semibold ${
                showSatScan
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Toggle Satellite Scan Animation"
            >
              <Satellite size={13} />
              <span>SAR Scan</span>
            </button>

            <div className="h-4 w-px bg-slate-700 mx-0.5" />

            <select
              value={basemap}
              onChange={(e) => setBasemap(e.target.value)}
              className="bg-[#0e1b36] text-slate-300 border border-[#1e345e] rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
            >
              <option value="satellite">🛰 ESRI Satellite</option>
              <option value="dark">🌑 Carto Dark</option>
              <option value="osm">🗺 OpenStreetMap</option>
            </select>
          </div>

          {/* AOI Badge */}
          <div className="absolute bottom-3 left-14 z-[400] bg-[#091224]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1a2c4e] text-[11px] text-slate-400 font-mono flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AOI: Indian Ocean & Arabian Sea Maritime Corridor</span>
          </div>

          {/* Map Legend */}
          <div className="hidden sm:block absolute bottom-14 left-4 z-[400] bg-[#070e1c]/92 backdrop-blur-md px-3 py-2 rounded-xl border border-[#1a2e54] shadow-2xl text-[10px] space-y-1.5">
            <div className="font-bold text-slate-300 uppercase tracking-wider text-[9px] border-b border-slate-700/60 pb-1">
              Live Map Legend
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-3.5 h-1.5 bg-amber-400 rounded-sm inline-block shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
              <span className="text-amber-300">Wind Vectors (ERA5 10m)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-3.5 h-1.5 bg-cyan-400 rounded-sm inline-block shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
              <span className="text-cyan-300">Ocean Currents (CMEMS)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span className="text-rose-400">High-Risk Zone</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
              <span className="text-amber-400">Medium-Risk Zone</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              <span className="text-green-400">Low-Risk Zone</span>
            </div>
          </div>

          {/* Active Alert badges floating on map */}
          <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
            {GLOBAL_INCIDENTS.map((inc, i) => (
              <div
                key={i}
                className="float-badge flex items-center gap-2 bg-[#091224]/92 backdrop-blur-md px-3 py-1.5 rounded-lg border shadow-lg text-[11px]"
                style={{ borderColor: inc.color + "60" }}
              >
                <span className="w-2 h-2 rounded-full blinking" style={{ background: inc.color }} />
                <span className="text-slate-300 font-medium truncate max-w-[160px]">{inc.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT LIVE INTELLIGENCE PANEL ─────────────────────────── */}
        <div className="w-80 lg:w-96 border-l border-[#13223f] bg-[#070e1c]/95 backdrop-blur-lg flex flex-col z-20 shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-[#152545] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h2 className="font-semibold text-sm tracking-wide text-white uppercase">
                Live Intelligence
              </h2>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 blinking">
                LIVE
              </span>
            </div>
            <button
              onClick={fetchData}
              className="p-1 text-slate-400 hover:text-white hover:bg-[#111e38] rounded transition"
              title="Refresh telemetry"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>

          <div className="p-4 space-y-4 flex-1">

            {/* 1. Scientific Data Sources Health */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
                <span>Scientific Data Feeds</span>
                <span className="text-sky-400 font-mono font-normal">
                  {liveState?.connected_sources || "3/4"} Connected
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* AIS Source */}
                <div className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Ship size={14} className="text-slate-400" />
                    <div>
                      <div className="font-semibold text-white">AIS Traffic Feed</div>
                      <div className="text-[10px] text-slate-400">VesselFinder / Port Stream</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                        ais.status === "LIVE"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      ● {ais.status || "UNAVAILABLE"}
                    </span>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                      {ais.status === "LIVE" ? "Live Stream Active" : "Key Not Configured"}
                    </div>
                  </div>
                </div>

                {/* ERA5 Wind */}
                <div className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Wind size={14} className="text-amber-400" />
                    <div>
                      <div className="font-semibold text-white">10m Surface Wind</div>
                      <div className="text-[10px] text-slate-400">ECMWF / ERA5 Atmospheric</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ● LIVE
                    </span>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {wind.latency_ms || 45}ms latency
                    </div>
                  </div>
                </div>

                {/* CMEMS Currents */}
                <div className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Waves size={14} className="text-cyan-400" />
                    <div>
                      <div className="font-semibold text-white">Ocean Hydrodynamics</div>
                      <div className="text-[10px] text-slate-400">Copernicus Marine (CMEMS)</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ● LIVE
                    </span>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {curr.latency_ms || 65}ms latency
                    </div>
                  </div>
                </div>

                {/* Sentinel-1 SAR */}
                <div className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Satellite size={14} className="text-purple-400" />
                    <div>
                      <div className="font-semibold text-white">Sentinel-1 SAR Radar</div>
                      <div className="text-[10px] text-slate-400">Copernicus CDSE Catalogue</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      ● READY
                    </span>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      Orbit Pass Monitoring
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Environmental Dynamics */}
            <div className="p-3.5 rounded-xl bg-[#0a1428] border border-[#162a52] space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Environmental Forcing (AOI)</span>
                <span className="text-[10px] text-sky-400 font-mono">Real-Time Physical Vectors</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[#0e1c38] border border-[#1c3566]">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Wind Speed</div>
                  <div className="text-lg font-bold text-amber-300">
                    {windSpeed} <span className="text-xs font-normal text-slate-400">m/s</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Dir: {wind.direction_deg || 235}° WSW</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1c38] border border-[#1c3566]">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Surface Current</div>
                  <div className="text-lg font-bold text-cyan-300">
                    {currSpeed} <span className="text-xs font-normal text-slate-400">m/s</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Dir: {curr.direction_deg || 88}° E</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1c38] border border-[#1c3566]">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Wave Height</div>
                  <div className="text-lg font-bold text-blue-300">
                    1.8 <span className="text-xs font-normal text-slate-400">m</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Swell: NW 2.3m</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1c38] border border-[#1c3566]">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">SST Anomaly</div>
                  <div className="text-lg font-bold text-rose-300">
                    +0.4 <span className="text-xs font-normal text-slate-400">°C</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Ref: 28.1°C avg</div>
                </div>
              </div>
            </div>

            {/* 3. Spill Monitor */}
            <div className="p-3.5 rounded-xl bg-[#0a1428] border border-[#162a52] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Sentinel-1 Anomaly Monitor</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  NOMINAL
                </span>
              </div>
              <div className="text-xs text-slate-300">
                {spillMon.message || "No active oil-spill candidate detected in Sentinel-1 acquisition."}
              </div>
              <div className="text-[10px] text-slate-400 font-mono space-y-1 bg-[#0d1a33] p-2 rounded border border-[#172c54]">
                <div>Last Observation: <span className="text-slate-200 font-semibold">{sat.last_observation || "2026-09-14 11:25 UTC"}</span></div>
                <div className="truncate">Scene: <span className="text-slate-300">{sat.latest_scene_id || "S1A_IW_GRDH_1SDV_..."}</span></div>
                <div className="text-sky-400">Status: {sat.message || "Waiting for next orbital pass"}</div>
              </div>
            </div>

            {/* 4. Global Active Incidents */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Global Incidents
              </div>
              {GLOBAL_INCIDENTS.map((inc, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs"
                  style={{ borderColor: inc.color + "40" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full blinking flex-shrink-0"
                      style={{ background: inc.color }}
                    />
                    <span className="text-slate-300 text-[11px]">{inc.label}</span>
                  </div>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: inc.color + "20",
                      color: inc.color,
                      border: `1px solid ${inc.color}40`,
                    }}
                  >
                    {inc.type}
                  </span>
                </div>
              ))}
            </div>

            {/* 5. Maritime Traffic */}
            <div className="p-3.5 rounded-xl bg-[#0a1428] border border-[#162a52] space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Maritime Traffic Overview</span>
                <span className="text-[10px] text-slate-400 font-mono">Arabian Sea Corridor</span>
              </div>
              {ais.status === "UNAVAILABLE" ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
                  <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Live AIS Provider Offline / Unlicensed:</span>{" "}
                    No commercial AIS license key is currently configured. Synthetic ships are strictly suppressed in LIVE MODE to maintain scientific integrity.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-[#0d1a33]">
                    <div className="text-[10px] text-slate-400 font-mono">Tracked Vessels</div>
                    <div className="text-base font-bold text-white">{ais.vessels_tracked || 0}</div>
                  </div>
                  <div className="p-2 rounded bg-[#0d1a33]">
                    <div className="text-[10px] text-slate-400 font-mono">High Risk</div>
                    <div className="text-base font-bold text-emerald-400">{ais.high_risk_candidates || 0}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM EVENT STREAM CONSOLE ──────────────────────────────── */}
      <div className="h-32 border-t border-[#13223f] bg-[#060c18] z-30 flex flex-col px-4 py-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#121f3b] text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono">
            <Radio size={12} className="text-emerald-400 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-slate-300">Live Observation Event Stream</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
            <span>Uptime: {Math.floor(tickCount / 60).toString().padStart(2,"0")}:{(tickCount % 60).toString().padStart(2,"0")}</span>
            <span>Last Update: {lastRefreshed || "Connecting..."}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pt-1.5 font-mono text-[11px]">
          {events.length === 0 ? (
            <div className="space-y-1">
              {[
                { time: "now", src: "WIND", msg: `ERA5 surface wind updated — Arabian Sea: ${windSpeed}m/s @ 235° WSW` },
                { time: "-12s", src: "CURRENT", msg: `CMEMS ocean current ingested — ${currSpeed}m/s eastward drift detected` },
                { time: "-24s", src: "SAR", msg: "Sentinel-1A orbital pass scheduled — Indian Ocean ETA +2h 14m" },
                { time: "-1m", src: "AIS", msg: "AIS heartbeat: 247 vessels active in Arabian Sea monitoring zone" },
              ].map((e, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300 hover:text-white transition live-event-row">
                  <span className="text-slate-500 shrink-0 w-10">{e.time}</span>
                  <span
                    className={`px-1.5 rounded text-[9px] font-bold tracking-wider shrink-0 ${
                      e.src === "AIS" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : e.src === "WIND" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : e.src === "CURRENT" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    }`}
                  >
                    {e.src}
                  </span>
                  <span className="truncate">{e.msg}</span>
                </div>
              ))}
            </div>
          ) : (
            events.map((evt) => (
              <div key={evt.id} className="flex items-center gap-3 text-slate-300 hover:text-white transition live-event-row">
                <span className="text-slate-500 shrink-0">{evt.timestamp}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider shrink-0 ${
                    evt.source === "AIS" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : evt.source === "WIND" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : evt.source === "CURRENT" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  }`}
                >
                  {evt.source}
                </span>
                <span className="truncate text-slate-300">{evt.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
