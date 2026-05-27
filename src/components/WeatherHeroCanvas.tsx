import { useEffect, useRef } from "react";

export interface WeatherHeroCanvasProps {
  weatherCode: number;
  isDay: 0 | 1;
}

type Group =
  | "SUNNY" | "PARTLY_CLOUDY" | "CLOUDY" | "FOG" | "FOG_ICE"
  | "DRIZZLE" | "FREEZING_DRIZZLE" | "RAIN" | "HEAVY_RAIN" | "FREEZING_RAIN"
  | "SNOW" | "SNOW_HEAVY" | "SNOW_GRAINS" | "SHOWER" | "SHOWER_SNOW"
  | "THUNDER" | "THUNDER_HAIL" | "NIGHT" | "CLOUDY_NIGHT";

export function getWeatherGroup(code: number, isDay: 0 | 1): Group {
  if (isDay === 0) {
    if (code === 0 || code === 1) return "NIGHT";
    if (code === 2 || code === 3) return "CLOUDY_NIGHT";
  }
  if (code === 0 || code === 1) return "SUNNY";
  if (code === 2) return "PARTLY_CLOUDY";
  if (code === 3) return "CLOUDY";
  if (code === 45) return "FOG";
  if (code === 48) return "FOG_ICE";
  if (code === 51 || code === 53 || code === 55) return "DRIZZLE";
  if (code === 56 || code === 57) return "FREEZING_DRIZZLE";
  if (code === 61 || code === 63) return "RAIN";
  if (code === 65 || code === 82) return "HEAVY_RAIN";
  if (code === 66 || code === 67) return "FREEZING_RAIN";
  if (code === 71 || code === 73) return "SNOW";
  if (code === 75 || code === 86) return "SNOW_HEAVY";
  if (code === 77) return "SNOW_GRAINS";
  if (code === 80 || code === 81) return "SHOWER";
  if (code === 85) return "SHOWER_SNOW";
  if (code === 95) return "THUNDER";
  if (code === 96 || code === 99) return "THUNDER_HAIL";
  return "CLOUDY";
}

export interface HeroPalette {
  background: string;
  text: string;
  subtext: string;
}

export function getHeroPalette(group: Group): HeroPalette {
  switch (group) {
    case "SUNNY":
      return { background: "linear-gradient(145deg, #ff9a3c, #ffcc02, #ffe566)", text: "#3d1a00", subtext: "rgba(61,26,0,0.7)" };
    case "PARTLY_CLOUDY":
      return { background: "linear-gradient(145deg, #b8cce0, #8aaac4, #6890b0)", text: "#1a2a3a", subtext: "rgba(26,42,58,0.7)" };
    case "CLOUDY":
      return { background: "linear-gradient(145deg, #8090a8, #6a7a92, #506070)", text: "#e8f0f8", subtext: "rgba(232,240,248,0.75)" };
    case "FOG":
    case "FOG_ICE":
      return { background: "linear-gradient(145deg, #b0b8c4, #98a4b0, #808c98)", text: "#1a2030", subtext: "rgba(26,32,48,0.7)" };
    case "DRIZZLE":
    case "RAIN":
      return { background: "linear-gradient(145deg, #3a6186, #254d70, #1a3a58)", text: "#d0e8f8", subtext: "rgba(208,232,248,0.75)" };
    case "HEAVY_RAIN":
      return { background: "linear-gradient(145deg, #1e3a5a, #152840, #0e1c30)", text: "#90c8f0", subtext: "rgba(144,200,240,0.75)" };
    case "FREEZING_DRIZZLE":
    case "FREEZING_RAIN":
      return { background: "linear-gradient(145deg, #5068a0, #3a5090, #2a3878)", text: "#c0d8f8", subtext: "rgba(192,216,248,0.75)" };
    case "SNOW":
    case "SNOW_HEAVY":
    case "SNOW_GRAINS":
    case "SHOWER_SNOW":
      return { background: "linear-gradient(145deg, #e0eef8, #c8dff0, #b0d0e8)", text: "#0a2a4a", subtext: "rgba(10,42,74,0.7)" };
    case "SHOWER":
      return { background: "linear-gradient(145deg, #2a5070, #1e3e58, #142c42)", text: "#a0c8e8", subtext: "rgba(160,200,232,0.75)" };
    case "THUNDER":
    case "THUNDER_HAIL":
      return { background: "linear-gradient(145deg, #0f0c29, #302b63, #24243e)", text: "#c8d0f0", subtext: "rgba(200,208,240,0.75)" };
    case "NIGHT":
    case "CLOUDY_NIGHT":
      return { background: "linear-gradient(145deg, #0d1117, #1a2035, #0a1525)", text: "#c0d0e8", subtext: "rgba(192,208,232,0.7)" };
  }
}

/* ---------------- particle types ---------------- */

interface Drop { x: number; y: number; len: number; speed: number; depth: 0 | 1 | 2; }
interface Flake { x: number; y: number; r: number; vy: number; sway: number; phase: number; depth: 0 | 1 | 2; }
interface CloudPuff { x: number; y: number; rx: number; ry: number; speed: number; alpha: number; tint: number; }
interface Star { x: number; y: number; r: number; phase: number; flickerAt: number; }
interface Hail { x: number; y: number; r: number; vy: number; }

function rand(min: number, max: number) { return min + Math.random() * (max - min); }

/* ---------------- atmosphere helpers ---------------- */

/** Soft radial cloud puff using a radial gradient. Light or dark variant. */
function drawCloudPuff(
  ctx: CanvasRenderingContext2D,
  c: CloudPuff,
  dark: boolean,
) {
  const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx);
  if (dark) {
    // tint = 0..1, lower = darker
    const base = 30 + c.tint * 30;
    grad.addColorStop(0, `rgba(${base},${base + 8},${base + 16},${c.alpha})`);
    grad.addColorStop(0.55, `rgba(${base},${base + 8},${base + 16},${c.alpha * 0.45})`);
    grad.addColorStop(1, `rgba(${base},${base + 8},${base + 16},0)`);
  } else {
    const base = 235 + c.tint * 15;
    grad.addColorStop(0, `rgba(${base},${base + 4},255,${c.alpha})`);
    grad.addColorStop(0.55, `rgba(${base},${base + 4},255,${c.alpha * 0.4})`);
    grad.addColorStop(1, `rgba(${base},${base + 4},255,0)`);
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Top arc of warm/cool light - subtle ambient lift behind the icon area. */
function drawLightArc(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  warm: boolean,
) {
  const cx = w * 0.5;
  const cy = -h * 0.3;
  const r = Math.max(w, h) * 1.1;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
  if (warm) {
    grad.addColorStop(0, "rgba(255,225,170,0.18)");
    grad.addColorStop(0.6, "rgba(255,200,140,0.05)");
    grad.addColorStop(1, "rgba(255,200,140,0)");
  } else {
    grad.addColorStop(0, "rgba(190,210,255,0.14)");
    grad.addColorStop(0.6, "rgba(150,180,230,0.04)");
    grad.addColorStop(1, "rgba(150,180,230,0)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** Edge-only vignette for depth, never darkens the center where text sits. */
function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.55, Math.min(w, h) * 0.45, w * 0.5, h * 0.55, Math.max(w, h) * 0.85);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawRainDrop(ctx: CanvasRenderingContext2D, d: Drop, angle: number, heavy: boolean) {
  const dx = Math.sin(angle) * d.len;
  const dy = Math.cos(angle) * d.len;
  const grad = ctx.createLinearGradient(d.x, d.y, d.x + dx, d.y + dy);
  // Depth-based opacity & color
  const tailAlpha = d.depth === 0 ? 0.35 : d.depth === 1 ? 0.7 : 0.95;
  grad.addColorStop(0, "rgba(180,215,255,0)");
  grad.addColorStop(1, heavy
    ? `rgba(120,170,240,${tailAlpha})`
    : `rgba(160,200,250,${tailAlpha})`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = d.depth === 0 ? 0.7 : d.depth === 1 ? 1.1 : (heavy ? 1.8 : 1.4);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.lineTo(d.x + dx, d.y + dy);
  ctx.stroke();
}

function drawFlake(ctx: CanvasRenderingContext2D, f: Flake) {
  // Soft bokeh-ish flake using radial gradient
  const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2.2);
  const alpha = f.depth === 0 ? 0.45 : f.depth === 1 ? 0.75 : 0.95;
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(0.5, `rgba(235,245,255,${alpha * 0.5})`);
  grad.addColorStop(1, "rgba(235,245,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r * 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawIceCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.strokeStyle = "rgba(186,230,253,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
}

/** Star with soft halo for bokeh depth. */
function drawStar(ctx: CanvasRenderingContext2D, s: Star, t: number) {
  const tw = 0.5 + 0.5 * Math.sin(t * 0.04 + s.phase);
  // occasional flicker (brief brighten)
  const flicker = Math.abs((t % 600) - s.flickerAt) < 4 ? 0.5 : 0;
  const alpha = 0.35 + tw * 0.5 + flicker;

  // halo
  const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
  halo.addColorStop(0, `rgba(255,255,255,${alpha * 0.35})`);
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
  ctx.fill();

  // core
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha + 0.2)})`;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------------- main component ---------------- */

export function WeatherHeroCanvas({ weatherCode, isDay }: WeatherHeroCanvasProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const group = getWeatherGroup(weatherCode, isDay);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let drops: Drop[] = [];
    let flakes: Flake[] = [];
    let clouds: CloudPuff[] = [];
    let stars: Star[] = [];
    let hail: Hail[] = [];
    let fogShift = 0;
    let flashTimer = 0;
    let nextFlash = 60 + Math.random() * 120;
    let boltPath: { x: number; y: number }[] = [];

    const buildBolt = () => {
      const path: { x: number; y: number }[] = [];
      let x = w * (0.35 + Math.random() * 0.3);
      let y = h * 0.05;
      path.push({ x, y });
      while (y < h * 0.9) {
        y += rand(h * 0.08, h * 0.18);
        x += rand(-w * 0.08, w * 0.08);
        path.push({ x, y });
      }
      return path;
    };

    const init = () => {
      drops = []; flakes = []; clouds = []; stars = []; hail = [];

      const cloudPuffCount =
        group === "PARTLY_CLOUDY" ? 6 :
        group === "CLOUDY" || group === "CLOUDY_NIGHT" ? 10 :
        group === "FOG" || group === "FOG_ICE" ? 8 :
        group === "SHOWER" || group === "SHOWER_SNOW" ? 7 :
        group === "THUNDER" || group === "THUNDER_HAIL" ? 10 :
        group === "RAIN" || group === "HEAVY_RAIN" || group === "DRIZZLE" ||
        group === "FREEZING_DRIZZLE" || group === "FREEZING_RAIN" ||
        group === "SNOW" || group === "SNOW_HEAVY" || group === "SNOW_GRAINS" ? 8 : 0;

      for (let i = 0; i < cloudPuffCount; i++) {
        const baseY = group === "FOG" || group === "FOG_ICE"
          ? rand(h * 0.3, h * 0.75)
          : rand(h * 0.05, h * 0.45);
        const rx = rand(80, 180);
        clouds.push({
          x: rand(-rx, w + rx),
          y: baseY,
          rx,
          ry: rx * rand(0.45, 0.65),
          speed: rand(0.04, 0.22),
          alpha: rand(0.35, 0.7),
          tint: Math.random(),
        });
      }

      const dropCount =
        group === "DRIZZLE" ? 36 :
        group === "FREEZING_DRIZZLE" ? 26 :
        group === "RAIN" ? 55 :
        group === "HEAVY_RAIN" ? 80 :
        group === "FREEZING_RAIN" ? 40 :
        group === "SHOWER" ? 36 :
        group === "THUNDER" || group === "THUNDER_HAIL" ? 60 :
        group === "SNOW_GRAINS" ? 20 : 0;

      for (let i = 0; i < dropCount; i++) {
        const depth = (Math.random() < 0.4 ? 0 : Math.random() < 0.7 ? 1 : 2) as 0 | 1 | 2;
        const lenBase = group === "HEAVY_RAIN" ? 22 : 16;
        const speedMax = group === "HEAVY_RAIN" ? 14 : group === "DRIZZLE" ? 5 : 10;
        const depthScale = depth === 0 ? 0.55 : depth === 1 ? 0.85 : 1.15;
        drops.push({
          x: rand(0, w),
          y: rand(-h, h),
          len: rand(6, lenBase) * depthScale,
          speed: rand(4, speedMax) * depthScale,
          depth,
        });
      }

      const flakeCount =
        group === "SNOW" ? 38 :
        group === "SNOW_HEAVY" ? 70 :
        group === "SNOW_GRAINS" ? 28 :
        group === "SHOWER_SNOW" ? 34 :
        group === "FREEZING_DRIZZLE" || group === "FREEZING_RAIN" ? 14 : 0;

      for (let i = 0; i < flakeCount; i++) {
        const depth = (Math.random() < 0.4 ? 0 : Math.random() < 0.75 ? 1 : 2) as 0 | 1 | 2;
        const rMax = group === "SNOW_HEAVY" ? 3 : 2.2;
        const depthScale = depth === 0 ? 0.6 : depth === 1 ? 0.95 : 1.3;
        flakes.push({
          x: rand(0, w),
          y: rand(-h, h),
          r: rand(0.9, rMax) * depthScale,
          vy: rand(0.3, 1.3) * depthScale,
          sway: rand(0.5, 1.5),
          phase: rand(0, Math.PI * 2),
          depth,
        });
      }

      if (group === "THUNDER_HAIL") {
        for (let i = 0; i < 20; i++) {
          hail.push({
            x: rand(0, w),
            y: rand(-h, h),
            r: rand(1.5, 2.6),
            vy: rand(5, 9),
          });
        }
      }

      if (group === "NIGHT" || group === "CLOUDY_NIGHT") {
        const starCount = group === "NIGHT" ? 70 : 32;
        for (let i = 0; i < starCount; i++) {
          stars.push({
            x: rand(0, w),
            y: rand(0, h * 0.75),
            r: rand(0.4, 1.6),
            phase: rand(0, Math.PI * 2),
            flickerAt: rand(0, 600),
          });
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      init();
    };

    let raf = 0;
    let t = 0;
    let visible = true;

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    resize();

    const dark =
      group === "CLOUDY" || group === "CLOUDY_NIGHT" || group === "HEAVY_RAIN" ||
      group === "THUNDER" || group === "THUNDER_HAIL" || group === "SHOWER";

    const warmArc = group === "SUNNY" || group === "PARTLY_CLOUDY";
    const coolArc =
      group === "NIGHT" || group === "CLOUDY_NIGHT" ||
      group === "THUNDER" || group === "THUNDER_HAIL" ||
      group === "HEAVY_RAIN" || group === "SHOWER";

    const renderStaticFrame = () => {
      ctx.clearRect(0, 0, w, h);
      if (warmArc || coolArc) drawLightArc(ctx, w, h, warmArc);
      for (const c of clouds) drawCloudPuff(ctx, c, dark);
      if (group === "NIGHT" || group === "CLOUDY_NIGHT") {
        for (const s of stars) drawStar(ctx, s, 0);
      }
      drawVignette(ctx, w, h, dark || group === "NIGHT" || group === "CLOUDY_NIGHT" ? 0.32 : 0.18);
    };

    if (reduced) {
      renderStaticFrame();
      return () => {
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }

    const render = () => {
      raf = requestAnimationFrame(render);
      if (!visible) return;
      t += 1;
      ctx.clearRect(0, 0, w, h);

      // ambient top light arc
      if (warmArc || coolArc) drawLightArc(ctx, w, h, warmArc);

      // Night sky stars (background layer)
      if (group === "NIGHT" || group === "CLOUDY_NIGHT") {
        for (const s of stars) drawStar(ctx, s, t);
      }

      // Clouds (volumetric puffs)
      for (const c of clouds) {
        c.x += c.speed;
        if (c.x - c.rx > w) c.x = -c.rx;
        drawCloudPuff(ctx, c, dark);
      }

      // Fog bands
      if (group === "FOG" || group === "FOG_ICE") {
        fogShift += 0.3;
        const baseColor = group === "FOG_ICE" ? "186,230,253" : "215,225,240";
        for (let i = 0; i < 6; i++) {
          const y = h * (0.25 + i * 0.11);
          const offset = Math.sin((t + i * 40) * 0.01) * 24 + fogShift * (i % 2 ? -1 : 1);
          const grad = ctx.createLinearGradient(0, y, w, y);
          grad.addColorStop(0, `rgba(${baseColor},0)`);
          grad.addColorStop(0.5, `rgba(${baseColor},0.4)`);
          grad.addColorStop(1, `rgba(${baseColor},0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(offset, y, w, 18);
        }
      }

      // Rain drops (parallax depths)
      const rainAngle =
        group === "HEAVY_RAIN" || group === "THUNDER" || group === "THUNDER_HAIL" ? 0.25 :
        group === "DRIZZLE" || group === "FREEZING_DRIZZLE" ? 0.1 : 0.18;
      const heavy = group === "HEAVY_RAIN" || group === "THUNDER" || group === "THUNDER_HAIL";
      if (drops.length) {
        for (const d of drops) {
          drawRainDrop(ctx, d, rainAngle, heavy);
          d.y += d.speed;
          d.x += Math.sin(rainAngle) * d.speed * 0.5;
          if (d.y > h) {
            d.y = -10;
            d.x = rand(-20, w);
          }
        }
      }

      // Snow (parallax depths)
      for (const f of flakes) {
        f.y += f.vy;
        f.x += Math.sin(t * 0.02 + f.phase) * f.sway * 0.3;
        if (f.y > h) {
          f.y = -5;
          f.x = rand(0, w);
        }
        drawFlake(ctx, f);
      }

      // Ice crystals
      if (group === "FREEZING_DRIZZLE" || group === "FREEZING_RAIN" || group === "FOG_ICE") {
        for (let i = 0; i < 6; i++) {
          drawIceCrystal(ctx, (t * 0.4 + i * 80) % (w + 40) - 20, h * 0.5 + Math.sin(i + t * 0.02) * 30, 4);
        }
      }

      // Hail
      for (const h0 of hail) {
        h0.y += h0.vy;
        if (h0.y > h) { h0.y = -10; h0.x = rand(0, w); }
        ctx.fillStyle = "rgba(220,228,255,0.95)";
        ctx.strokeStyle = "rgba(80,90,160,0.8)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(h0.x, h0.y, h0.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Lightning: local glow around bolt instead of full-screen flash
      if (group === "THUNDER" || group === "THUNDER_HAIL") {
        flashTimer++;
        if (flashTimer > nextFlash) {
          const phase = flashTimer - nextFlash;
          if (phase === 1 || boltPath.length === 0) boltPath = buildBolt();
          if (phase < 10) {
            const fade = 1 - phase / 10;
            // local warm glow ellipse along bolt
            const midX = boltPath[Math.floor(boltPath.length / 2)]?.x ?? w * 0.5;
            const glow = ctx.createRadialGradient(midX, h * 0.45, 0, midX, h * 0.45, Math.max(w, h) * 0.55);
            glow.addColorStop(0, `rgba(255,245,210,${0.45 * fade})`);
            glow.addColorStop(0.4, `rgba(255,230,170,${0.18 * fade})`);
            glow.addColorStop(1, "rgba(255,220,150,0)");
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w, h);

            // bolt
            ctx.strokeStyle = "#fffbe6";
            ctx.lineWidth = group === "THUNDER_HAIL" ? 2.6 : 2;
            ctx.shadowColor = "#fde047";
            ctx.shadowBlur = 22 * fade + 6;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            for (let i = 0; i < boltPath.length; i++) {
              const p = boltPath[i];
              if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else {
            flashTimer = 0;
            nextFlash = 80 + Math.random() * 220;
            boltPath = [];
          }
        }
      }

      // Edge vignette for depth & readability
      drawVignette(
        ctx, w, h,
        dark || group === "NIGHT" || group === "CLOUDY_NIGHT" ? 0.32 : 0.18,
      );
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [group]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        borderRadius: "inherit",
      }}
    />
  );
}
