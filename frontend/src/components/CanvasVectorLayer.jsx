/**
 * CanvasVectorLayer.jsx — Global High-Performance Environmental Flow
 *
 * Renders smooth, zoom-adaptive vector arrows & dynamic particle flow
 * all over the world ocean:
 * 1. Atmospheric 10m Wind — Warm Amber / Golden Glow arrows & particles
 * 2. Ocean Hydrodynamic Surface Currents — Electric Cyan / Marine Blue arrows & particles
 *
 * Physics-based global flow includes:
 * - Trade Winds, Mid-latitude Westerlies, Polar Easterlies, and Arabian Sea SW Monsoon
 * - Major Ocean Gyres (Gulf Stream, Kuroshio, Antarctic Circumpolar, Somali Current, WICC, Agulhas)
 * - Continents landmask to keep flow strictly over global oceans & seas
 */
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

// ─── Color ramps ─────────────────────────────────────────────────────────────
function getWindStyle(spd) {
  if (spd < 4.5) return "rgba(253,224,71,0.92)";  // Light breeze — Yellow-300
  if (spd < 9.0) return "rgba(245,158,11,0.97)";  // Moderate — Amber-500
  return "rgba(234,88,12,0.98)";                   // Strong wind — Orange-600
}

function getCurrentStyle(spd) {
  if (spd < 0.30) return "rgba(56,189,248,0.88)";  // Light drift — Sky-400
  if (spd < 0.65) return "rgba(6,182,212,0.97)";   // Moderate current — Cyan-500
  return "rgba(2,132,199,0.99)";                   // Strong boundary current — Sky-700
}

// ─── Global Land Mask (prevents vectors/particles over continents) ───────────
function isWorldLand(lat, lon) {
  // Normalize lon to [-180, 180]
  let l = ((lon + 180) % 360 + 360) % 360 - 180;

  // Antarctica
  if (lat < -66.0) return true;
  // Greenland
  if (lat > 60.0 && lat < 83.0 && l > -60.0 && l < -20.0) return true;

  // Africa
  if (lat >= -35.0 && lat <= 37.0 && l >= -18.0 && l <= 51.5) {
    // Exclude Red Sea & Mediterranean Sea
    if (lat > 12.0 && lat < 28.5 && l > 32.0 && l < 43.5) return false;
    if (lat > 30.5 && lat < 36.5 && l > -5.0 && l < 35.0) return false;
    // Madagascar
    if (lat > -26.0 && lat < -11.5 && l > 43.0 && l < 51.0) return true;
    if (l > 44.0 && lat < -10.0) return false; // Mozambique channel
    return true;
  }

  // India & South Asia
  if (lat >= 8.2 && lat <= 35.5 && l >= 68.5 && l <= 97.0) {
    // Arabian Sea / coastal allowance
    if (lat < 23.0 && l < 72.8) return false;
    if (lat < 16.0 && l < 73.5) return false;
    if (lat < 10.0 && l < 76.2) return false;
    // Bay of Bengal coastal allowance
    if (lat < 21.0 && l > 80.3 && lat > 12.5) return false;
    if (lat < 12.5 && l > 79.8) return false;
    return true;
  }

  // Eurasia (Europe & Northern/Central Asia)
  if (lat >= 36.0 && lat <= 78.0 && l >= -10.0 && l <= 180.0) {
    // Baltic Sea
    if (lat > 53.0 && lat < 66.0 && l > 10.0 && l < 30.0) return false;
    // Black Sea
    if (lat > 40.5 && lat < 47.0 && l > 27.0 && l < 42.0) return false;
    // Mediterranean Sea
    if (lat < 42.0 && l > -5.0 && l < 36.0) return false;
    // North Sea / Norwegian Sea
    if (lat > 51.0 && lat < 62.0 && l > -4.0 && l < 9.0) return false;
    return true;
  }

  // North America
  if (lat >= 14.5 && lat <= 72.0 && l >= -168.0 && l <= -52.0) {
    // Gulf of Mexico
    if (lat > 18.0 && lat < 30.0 && l > -98.0 && l < -81.0) return false;
    // Caribbean Sea
    if (lat > 10.0 && lat < 22.0 && l > -88.0 && l < -60.0) return false;
    // Hudson Bay
    if (lat > 51.0 && lat < 64.0 && l > -95.0 && l < -78.0) return false;
    return true;
  }

  // South America
  if (lat >= -56.0 && lat <= 12.5 && l >= -82.0 && l <= -34.5) return true;

  // Australia
  if (lat >= -44.0 && lat <= -10.5 && l >= 113.0 && l <= 154.0) return true;

  return false;
}

// ─── Global Wind Model (Hadley, Ferrel, Polar cells & Monsoon) ───────────────
function getGlobalWindVector(lat, lon) {
  // 1. Regional Indian Ocean / Arabian Sea (SW Monsoon)
  if (lat >= 0.0 && lat <= 26.0 && lon >= 45.0 && lon <= 100.0) {
    const dir = (65 + Math.sin(lat * 0.18 + lon * 0.15) * 22 + (lat > 15 ? 15 : -10) + 360) % 360;
    const spd = Math.max(3.5, 6.2 + Math.cos(lat * 0.22) * 2.2 + Math.sin(lon * 0.18) * 1.4);
    return { speed: spd, bearing: dir };
  }

  // 2. Tropical Trade Winds (0° to 30°N/S)
  if (Math.abs(lat) <= 30.0) {
    if (lat >= 0) {
      // Northern Hemisphere NE Trades (blow toward WSW, bearing ~245°)
      const dir = (235 + Math.sin(lon * 0.08) * 20 + 360) % 360;
      const spd = 6.0 + Math.sin(lat * 0.1) * 2.5;
      return { speed: spd, bearing: dir };
    } else {
      // Southern Hemisphere SE Trades (blow toward WNW, bearing ~295°)
      const dir = (295 + Math.cos(lon * 0.08) * 20 + 360) % 360;
      const spd = 6.8 + Math.cos(lat * 0.1) * 2.8;
      return { speed: spd, bearing: dir };
    }
  }

  // 3. Mid-latitude Westerlies (30° to 60°N/S)
  if (Math.abs(lat) > 30.0 && Math.abs(lat) <= 60.0) {
    // Strong eastward westerlies (Roaring Forties in SH)
    const baseDir = lat > 0 ? 80 : 90;
    const dir = (baseDir + Math.sin(lat * 0.15 + lon * 0.05) * 25 + 360) % 360;
    const spd = Math.abs(lat) > 40 ? 11.5 + Math.sin(lon * 0.05) * 3.5 : 8.5;
    return { speed: spd, bearing: dir };
  }

  // 4. Polar Easterlies (> 60°N/S)
  const pDir = lat > 0 ? 250 : 280;
  return { speed: 6.5, bearing: (pDir + Math.sin(lon * 0.1) * 30 + 360) % 360 };
}

// ─── Global Ocean Currents Model (Gyres & Boundary Currents) ─────────────────
function getGlobalCurrentVector(lat, lon) {
  // 1. Regional Arabian Sea & Bay of Bengal
  if (lat >= 0.0 && lat <= 26.0 && lon >= 50.0 && lon <= 95.0) {
    let dir = 135;
    let spd = 0.42;
    if (lat >= 8.0 && lat <= 22.0 && lon >= 68.0 && lon <= 75.0) {
      // West India Coastal Current (WICC) flowing South-Southeast
      dir = 162 + Math.sin(lat * 0.3) * 12;
      spd = 0.52 + Math.cos(lat * 0.25) * 0.2;
    } else if (lat >= 8.0 && lat <= 22.0 && lon >= 80.0 && lon <= 92.0) {
      // East India Coastal Current (EICC)
      dir = 48 + Math.sin(lon * 0.25) * 20;
      spd = 0.46;
    } else if (lat < 8.0) {
      // Equatorial Jet
      dir = 88;
      spd = 0.65;
    }
    return { speed: Math.max(0.15, spd), direction: dir };
  }

  // 2. North Atlantic (Gulf Stream & North Atlantic Drift)
  if (lat >= 20.0 && lat <= 65.0 && lon >= -82.0 && lon <= -10.0) {
    let dir = 55;
    let spd = 0.75;
    if (lat >= 25.0 && lat <= 42.0 && lon >= -80.0 && lon <= -60.0) {
      // Gulf Stream western boundary jet
      dir = 42;
      spd = 1.25;
    }
    return { speed: spd, direction: dir };
  }

  // 3. North Pacific (Kuroshio & North Pacific Drift)
  if (lat >= 15.0 && lat <= 55.0 && lon >= 120.0 && lon <= 180.0) {
    let dir = 60;
    let spd = 0.65;
    if (lat >= 22.0 && lat <= 38.0 && lon >= 125.0 && lon <= 150.0) {
      // Kuroshio Current
      dir = 50;
      spd = 1.15;
    }
    return { speed: spd, direction: dir };
  }

  // 4. Southern Ocean (Antarctic Circumpolar Current - ACC)
  if (lat <= -40.0 && lat >= -65.0) {
    // Continuous eastward circumpolar drift
    const dir = (90 + Math.sin(lon * 0.05) * 15 + 360) % 360;
    return { speed: 0.72, direction: dir };
  }

  // 5. Agulhas Current (Southeast Africa)
  if (lat >= -38.0 && lat <= -20.0 && lon >= 25.0 && lon <= 42.0) {
    return { speed: 1.10, direction: 220 };
  }

  // 6. Global Equatorial Currents (Pacific, Atlantic)
  if (Math.abs(lat) <= 12.0) {
    // Broad westward equatorial drift
    return { speed: 0.55, direction: 270 };
  }

  // Default global ocean surface drift
  const defDir = lat > 0 ? 75 : 105;
  return { speed: 0.32, direction: (defDir + Math.sin(lat * 0.1 + lon * 0.08) * 35 + 360) % 360 };
}

export function CanvasVectorLayer({
  showWind = false,
  showCurrent = false,
}) {
  const map = useMap();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const stateRef = useRef({
    particles: [],
    staticArrows: [],
    lastTime: performance.now(),
    needsGridRebuild: true,
  });

  const activeRef = useRef({ showWind, showCurrent });
  useEffect(() => {
    activeRef.current = { showWind, showCurrent };
    stateRef.current.needsGridRebuild = true;
  }, [showWind, showCurrent]);

  useEffect(() => {
    const handleMoveOrZoom = () => {
      stateRef.current.needsGridRebuild = true;
    };

    map.on("moveend", handleMoveOrZoom);
    map.on("zoomend", handleMoveOrZoom);
    return () => {
      map.off("moveend", handleMoveOrZoom);
      map.off("zoomend", handleMoveOrZoom);
    };
  }, [map]);

  useEffect(() => {
    let isCancelled = false;

    const buildGridIfNeeded = (canvas) => {
      const st = stateRef.current;
      if (!st.needsGridRebuild) return;
      st.needsGridRebuild = false;

      const { showWind: isW, showCurrent: isC } = activeRef.current;
      if (!isW && !isC) {
        st.staticArrows = [];
        st.particles = [];
        return;
      }

      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const size = map.getSize();

      // Dynamic adaptive grid step for global zooming
      const step = zoom <= 3 ? 6.0 : zoom <= 5 ? 3.2 : zoom <= 7 ? 1.8 : zoom <= 9 ? 0.9 : 0.45;
      const S = Math.max(-75, bounds.getSouth());
      const N = Math.min(80, bounds.getNorth());
      const W = bounds.getWest();
      const E = bounds.getEast();

      const arrows = [];
      for (let lat = S; lat <= N; lat += step) {
        for (let lon = W; lon <= E; lon += step) {
          if (isWorldLand(lat, lon)) continue;
          const pt = map.latLngToContainerPoint([lat, lon]);
          if (pt.x < -25 || pt.x > size.x + 25 || pt.y < -25 || pt.y > size.y + 25) continue;

          // 1. WIND ARROWS (Golden Amber)
          if (isW) {
            const w = getGlobalWindVector(lat, lon);
            const rad = (w.bearing * Math.PI) / 180;
            const offX = isC ? -4 : 0;
            const offY = isC ? -4 : 0;
            arrows.push({
              x: pt.x + offX,
              y: pt.y + offY,
              rad,
              len: Math.min(18, 9 + w.speed * 0.9),
              color: getWindStyle(w.speed),
              type: "wind",
            });
          }

          // 2. OCEAN CURRENT ARROWS (Electric Cyan)
          if (isC) {
            const c = getGlobalCurrentVector(lat, lon);
            const rad = (c.direction * Math.PI) / 180;
            const offX = isW ? 4 : 0;
            const offY = isW ? 4 : 0;
            arrows.push({
              x: pt.x + offX,
              y: pt.y + offY,
              rad,
              len: Math.min(17, 8 + c.speed * 12),
              color: getCurrentStyle(c.speed),
              type: "current",
            });
          }
        }
      }
      st.staticArrows = arrows;

      // Seed dynamic animated flow particles — larger count for global impact
      const count = isW && isC ? 600 : isW ? 400 : 350;
      const newParticles = [];
      for (let i = 0; i < count; i++) {
        const lat = S + Math.random() * (N - S);
        const lon = W + Math.random() * (E - W);
        if (!isWorldLand(lat, lon)) {
          const isCurrentParticle = isC && (!isW || i % 2 === 1);
          newParticles.push({
            lat,
            lon,
            age: Math.floor(Math.random() * 80),
            maxAge: 60 + Math.floor(Math.random() * 60),
            isCurrent: isCurrentParticle,
          });
        }
      }
      st.particles = newParticles;
    };

    const animate = (time) => {
      if (isCancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const { showWind: isW, showCurrent: isC } = activeRef.current;
      if (!isW && !isC) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = null;
        return;
      }

      const size = map.getSize();
      if (canvas.width !== size.x || canvas.height !== size.y) {
        canvas.width = size.x;
        canvas.height = size.y;
        stateRef.current.needsGridRebuild = true;
      }

      buildGridIfNeeded(canvas);

      const ctx = canvas.getContext("2d");
      const st = stateRef.current;

      // Smooth flowing fade trails
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";

      // 1. Draw directional arrows with crisp heads
      for (let i = 0; i < st.staticArrows.length; i++) {
        const a = st.staticArrows[i];
        const tox = a.x + Math.cos(a.rad) * a.len;
        const toy = a.y + Math.sin(a.rad) * a.len;

        ctx.beginPath();
        ctx.strokeStyle = a.color;
        ctx.lineWidth = a.type === "wind" ? 1.3 : 1.5;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(tox, toy);
        ctx.stroke();

        const headLen = Math.max(4.0, a.len * 0.32);
        const a1 = a.rad - Math.PI / 6.5;
        const a2 = a.rad + Math.PI / 6.5;

        ctx.beginPath();
        ctx.moveTo(tox, toy);
        ctx.lineTo(tox - headLen * Math.cos(a1), toy - headLen * Math.sin(a1));
        ctx.lineTo(tox - headLen * Math.cos(a2), toy - headLen * Math.sin(a2));
        ctx.closePath();
        ctx.fillStyle = a.color;
        ctx.fill();
      }

      // 2. Advance and render global oceanic particles
      const bounds = map.getBounds();
      const S = Math.max(-75, bounds.getSouth());
      const N = Math.min(80, bounds.getNorth());
      const W = bounds.getWest();
      const E = bounds.getEast();

      for (let i = 0; i < st.particles.length; i++) {
        const p = st.particles[i];
        p.age++;

        if (p.age >= p.maxAge || p.lat < S || p.lat > N || p.lon < W || p.lon > E || isWorldLand(p.lat, p.lon)) {
          p.lat = S + Math.random() * (N - S);
          p.lon = W + Math.random() * (E - W);
          p.age = 0;
          continue;
        }

        if (p.isCurrent) {
          // Ocean current particle (Cyan) — slightly larger for visibility
          const cur = getGlobalCurrentVector(p.lat, p.lon);
          const rad = (cur.direction * Math.PI) / 180;
          p.lat += Math.cos(rad) * 0.009;
          p.lon += Math.sin(rad) * 0.009;
          const pt = map.latLngToContainerPoint([p.lat, p.lon]);
          const alpha = Math.min(1, (1 - p.age / p.maxAge) * 1.4);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = getCurrentStyle(cur.speed).replace(/[\d.]+\)$/, `${alpha})`);
          ctx.fill();
        } else {
          // Wind particle (Amber) — slightly larger for visibility
          const w = getGlobalWindVector(p.lat, p.lon);
          const rad = (w.bearing * Math.PI) / 180;
          p.lat += Math.cos(rad) * 0.015;
          p.lon += Math.sin(rad) * 0.015;
          const pt = map.latLngToContainerPoint([p.lat, p.lon]);
          const alpha = Math.min(1, (1 - p.age / p.maxAge) * 1.4);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = getWindStyle(w.speed).replace(/[\d.]+\)$/, `${alpha})`);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    if (showWind || showCurrent) {
      rafRef.current = requestAnimationFrame(animate);
    }

    return () => {
      isCancelled = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [map, showWind, showCurrent]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[350]"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
