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

/* ---------------- canvas particle helpers ---------------- */

interface Drop { x: number; y: number; len: number; speed: number; }
interface Flake { x: number; y: number; r: number; vy: number; sway: number; phase: number; }
interface Cloud { x: number; y: number; scale: number; speed: number; alpha: number; }
interface Star { x: number; y: number; r: number; phase: number; }
interface Hail { x: number; y: number; r: number; vy: number; }

function rand(min: number, max: number) { return min + Math.random() * (max - min); }

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, alpha: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 28, Math.PI, 0);
  ctx.arc(28, -8, 22, Math.PI, 0);
  ctx.arc(56, 0, 26, Math.PI, 0);
  ctx.lineTo(56, 18);
  ctx.lineTo(-28, 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pulse: number, rot: number) {
  const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.2);
  grad.addColorStop(0, "rgba(255,240,180,0.9)");
  grad.addColorStop(0.4, "rgba(255,200,80,0.35)");
  grad.addColorStop(1, "rgba(255,160,40,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2 * (1 + pulse * 0.1), 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = "rgba(255,220,120,0.7)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    const a = (i * Math.PI * 2) / 12;
    const inner = r * 1.15;
    const outer = r * 1.55 + Math.sin(pulse + i) * 4;
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();

  const core = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  core.addColorStop(0, "#fffbe6");
  core.addColorStop(1, "#f59e0b");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, bgColor: string) {
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y - r * 0.15, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
}

function drawRainDrop(ctx: CanvasRenderingContext2D, d: Drop, angle: number, heavy = false) {
  const grad = ctx.createLinearGradient(d.x, d.y, d.x + Math.sin(angle) * d.len, d.y + Math.cos(angle) * d.len);
  grad.addColorStop(0, "rgba(160,210,255,0)");
  grad.addColorStop(1, heavy ? "#3b82f6" : "#93c5fd");
  ctx.strokeStyle = grad;
  ctx.lineWidth = heavy ? 1.6 : 1.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.lineTo(d.x + Math.sin(angle) * d.len, d.y + Math.cos(angle) * d.len);
  ctx.stroke();
}

function drawFlake(ctx: CanvasRenderingContext2D, f: Flake) {
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawIceCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.strokeStyle = "rgba(186,230,253,0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
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

    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      init();
    };

    let drops: Drop[] = [];
    let flakes: Flake[] = [];
    let clouds: Cloud[] = [];
    let stars: Star[] = [];
    let hail: Hail[] = [];
    let fogShift = 0;
    let flashTimer = 0;
    let nextFlash = 60 + Math.random() * 120;

    const palette = getHeroPalette(group);
    const bgColorBase = palette.background.match(/#[0-9a-fA-F]{6}/)?.[0] ?? "#1a2a3a";

    const init = () => {
      drops = []; flakes = []; clouds = []; stars = []; hail = [];

      const cloudCount =
        group === "PARTLY_CLOUDY" ? 2 :
        group === "CLOUDY" || group === "CLOUDY_NIGHT" ? 4 :
        group === "FOG" || group === "FOG_ICE" ? 3 :
        group === "SHOWER" || group === "SHOWER_SNOW" ? 3 :
        group === "THUNDER" || group === "THUNDER_HAIL" ? 4 :
        group === "RAIN" || group === "HEAVY_RAIN" || group === "DRIZZLE" ||
        group === "FREEZING_DRIZZLE" || group === "FREEZING_RAIN" ||
        group === "SNOW" || group === "SNOW_HEAVY" || group === "SNOW_GRAINS" ? 3 : 0;

      for (let i = 0; i < cloudCount; i++) {
        clouds.push({
          x: rand(-50, w),
          y: rand(h * 0.05, h * 0.45),
          scale: rand(0.5, 1.2),
          speed: rand(0.05, 0.25),
          alpha: rand(0.3, 0.75),
        });
      }

      const dropCount =
        group === "DRIZZLE" ? 30 :
        group === "FREEZING_DRIZZLE" ? 22 :
        group === "RAIN" ? 45 :
        group === "HEAVY_RAIN" ? 65 :
        group === "FREEZING_RAIN" ? 35 :
        group === "SHOWER" ? 30 :
        group === "THUNDER" || group === "THUNDER_HAIL" ? 50 :
        group === "SNOW_GRAINS" ? 18 : 0;

      for (let i = 0; i < dropCount; i++) {
        drops.push({
          x: rand(0, w),
          y: rand(-h, h),
          len: rand(8, group === "HEAVY_RAIN" ? 22 : 16),
          speed: rand(6, group === "HEAVY_RAIN" ? 14 : group === "DRIZZLE" ? 5 : 10),
        });
      }

      const flakeCount =
        group === "SNOW" ? 35 :
        group === "SNOW_HEAVY" ? 60 :
        group === "SNOW_GRAINS" ? 25 :
        group === "SHOWER_SNOW" ? 30 :
        group === "FREEZING_DRIZZLE" || group === "FREEZING_RAIN" ? 12 : 0;

      for (let i = 0; i < flakeCount; i++) {
        flakes.push({
          x: rand(0, w),
          y: rand(-h, h),
          r: rand(1.2, group === "SNOW_HEAVY" ? 3 : 2.2),
          vy: rand(0.4, 1.4),
          sway: rand(0.5, 1.5),
          phase: rand(0, Math.PI * 2),
        });
      }

      if (group === "THUNDER_HAIL") {
        for (let i = 0; i < 18; i++) {
          hail.push({
            x: rand(0, w),
            y: rand(-h, h),
            r: rand(1.5, 2.5),
            vy: rand(5, 9),
          });
        }
      }

      if (group === "NIGHT" || group === "CLOUDY_NIGHT") {
        const starCount = group === "NIGHT" ? 60 : 30;
        for (let i = 0; i < starCount; i++) {
          stars.push({
            x: rand(0, w),
            y: rand(0, h * 0.7),
            r: rand(0.4, 1.5),
            phase: rand(0, Math.PI * 2),
          });
        }
      }
    };

    let raf = 0;
    let t = 0;

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const render = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      // Night sky stars
      if (group === "NIGHT" || group === "CLOUDY_NIGHT") {
        for (const s of stars) {
          const tw = 0.5 + 0.5 * Math.sin(t * 0.05 + s.phase);
          ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.6})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Sun
      if (group === "SUNNY") {
        const pulse = Math.sin(t * 0.04) * 0.5 + 0.5;
        drawSun(ctx, w * 0.78, h * 0.35, Math.min(w, h) * 0.16, pulse, t * 0.005);
      }
      if (group === "PARTLY_CLOUDY") {
        drawSun(ctx, w * 0.82, h * 0.28, Math.min(w, h) * 0.11, 0.3, t * 0.004);
      }
      if (group === "SHOWER" || group === "SHOWER_SNOW") {
        drawSun(ctx, w * 0.85, h * 0.22, Math.min(w, h) * 0.08, 0.2, t * 0.004);
      }

      // Moon
      if (group === "NIGHT") {
        drawMoon(ctx, w * 0.8, h * 0.3, Math.min(w, h) * 0.11, bgColorBase);
      }
      if (group === "CLOUDY_NIGHT") {
        drawMoon(ctx, w * 0.82, h * 0.25, Math.min(w, h) * 0.08, bgColorBase);
      }

      // Clouds
      for (const c of clouds) {
        c.x += c.speed;
        if (c.x - 80 > w) c.x = -80;
        const dark = group === "CLOUDY" || group === "CLOUDY_NIGHT" || group === "HEAVY_RAIN" ||
                     group === "THUNDER" || group === "THUNDER_HAIL" || group === "SHOWER";
        drawCloud(ctx, c.x, c.y, c.scale, c.alpha, dark ? "#1e293b" : "#ffffff");
      }

      // Fog bands
      if (group === "FOG" || group === "FOG_ICE") {
        fogShift += 0.3;
        const baseColor = group === "FOG_ICE" ? "186,230,253" : "203,213,225";
        for (let i = 0; i < 5; i++) {
          const y = h * (0.3 + i * 0.12);
          const offset = Math.sin((t + i * 40) * 0.01) * 20 + fogShift * (i % 2 ? -1 : 1);
          const grad = ctx.createLinearGradient(0, y, w, y);
          grad.addColorStop(0, `rgba(${baseColor},0)`);
          grad.addColorStop(0.5, `rgba(${baseColor},0.45)`);
          grad.addColorStop(1, `rgba(${baseColor},0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(offset, y, w, 14);
        }
      }

      // Rain drops
      const rainAngle =
        group === "HEAVY_RAIN" || group === "THUNDER" || group === "THUNDER_HAIL" ? 0.25 :
        group === "DRIZZLE" || group === "FREEZING_DRIZZLE" ? 0.1 : 0.18;
      if (drops.length) {
        for (const d of drops) {
          drawRainDrop(ctx, d, rainAngle, group === "HEAVY_RAIN" || group === "THUNDER" || group === "THUNDER_HAIL");
          d.y += d.speed;
          d.x += Math.sin(rainAngle) * d.speed * 0.5;
          if (d.y > h) {
            d.y = -10;
            d.x = rand(-20, w);
          }
        }
      }

      // Snow
      for (const f of flakes) {
        f.y += f.vy;
        f.x += Math.sin(t * 0.02 + f.phase) * f.sway * 0.3;
        if (f.y > h) {
          f.y = -5;
          f.x = rand(0, w);
        }
        drawFlake(ctx, f);
      }

      // Ice crystals for freezing variants
      if (group === "FREEZING_DRIZZLE" || group === "FREEZING_RAIN" || group === "FOG_ICE") {
        for (let i = 0; i < 6; i++) {
          drawIceCrystal(ctx, (t * 0.4 + i * 80) % (w + 40) - 20, h * 0.5 + Math.sin(i + t * 0.02) * 30, 4);
        }
      }

      // Hail
      for (const h0 of hail) {
        h0.y += h0.vy;
        if (h0.y > h) { h0.y = -10; h0.x = rand(0, w); }
        ctx.fillStyle = "rgba(199,210,254,0.95)";
        ctx.strokeStyle = "#4338ca";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(h0.x, h0.y, h0.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Lightning flash
      if (group === "THUNDER" || group === "THUNDER_HAIL") {
        flashTimer++;
        if (flashTimer > nextFlash) {
          const phase = flashTimer - nextFlash;
          if (phase < 8) {
            ctx.fillStyle = `rgba(255,255,240,${0.7 - phase * 0.08})`;
            ctx.fillRect(0, 0, w, h);
            // bolt
            ctx.strokeStyle = "#fffbe6";
            ctx.lineWidth = group === "THUNDER_HAIL" ? 3 : 2;
            ctx.shadowColor = "#fde047";
            ctx.shadowBlur = 18;
            ctx.beginPath();
            const bx = w * 0.5;
            ctx.moveTo(bx, h * 0.1);
            ctx.lineTo(bx - 15, h * 0.4);
            ctx.lineTo(bx + 8, h * 0.45);
            ctx.lineTo(bx - 18, h * 0.85);
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else {
            flashTimer = 0;
            nextFlash = 80 + Math.random() * 200;
          }
        }
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
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
