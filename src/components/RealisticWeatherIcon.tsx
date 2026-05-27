import { useId } from "react";

export interface WeatherIconProps {
  code: number;
  isDay: 0 | 1;
  size?: number;
  className?: string;
}

/**
 * Realistic SVG weather icons with embedded gradients.
 * Each instance generates unique gradient IDs to avoid conflicts across multiple
 * instances on the same page.
 */
export function RealisticWeatherIcon({ code, isDay, size = 24, className }: WeatherIconProps) {
  const uid = useId().replace(/[:]/g, "");
  const props = { size, uid, className };

  // Night variants
  if (isDay === 0) {
    if (code === 0) return <Moon {...props} />;
    if (code === 1) return <MoonLightCloud {...props} />;
    if (code === 2) return <CloudyNight {...props} />;
    if (code === 3) return <Overcast {...props} />;
  }

  if (code === 0) return <Sun {...props} />;
  if (code === 1) return <MainlySunny {...props} />;
  if (code === 2) return <PartlyCloudy {...props} />;
  if (code === 3) return <Overcast {...props} />;
  if (code === 45) return <Fog {...props} />;
  if (code === 48) return <FreezingFog {...props} />;
  if (code === 51 || code === 53) return <Drizzle {...props} drops={5} />;
  if (code === 55) return <Drizzle {...props} drops={7} dark />;
  if (code === 56 || code === 57) return <FreezingDrizzle {...props} />;
  if (code === 61 || code === 63) return <Rain {...props} drops={5} />;
  if (code === 65 || code === 82) return <Rain {...props} drops={7} heavy />;
  if (code === 66 || code === 67) return <FreezingRain {...props} />;
  if (code === 71 || code === 73) return <Snow {...props} flakes={5} />;
  if (code === 75 || code === 86) return <Snow {...props} flakes={7} big />;
  if (code === 77) return <SnowGrains {...props} />;
  if (code === 80 || code === 81) return <ShowerRain {...props} />;
  if (code === 85) return <ShowerSnow {...props} />;
  if (code === 95) return <Thunder {...props} />;
  if (code === 96 || code === 99) return <ThunderHail {...props} />;

  return <Overcast {...props} />;
}

type Base = { size: number; uid: string; className?: string };

function Frame({ size, className, children }: { size: number; className?: string; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      {children}
    </svg>
  );
}

/* ---------- shared paint helpers ---------- */

function CloudGradient({ id, dark = false }: { id: string; dark?: boolean }) {
  // Mittleres Grau — nie heller als #6B7280 im Light Mode.
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={dark ? "#9CA3AF" : "#6B7280"} stopOpacity="1" />
      <stop offset="100%" stopColor={dark ? "#6B7280" : "#4B5563"} stopOpacity="1" />
    </linearGradient>
  );
}

function DropGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#7dd3fc" stopOpacity="1" />
      <stop offset="100%" stopColor="#1d4ed8" stopOpacity="1" />
    </linearGradient>
  );
}

function SunGradient({ id }: { id: string }) {
  return (
    <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
      <stop offset="55%" stopColor="#fde68a" stopOpacity="1" />
      <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
    </radialGradient>
  );
}

function MoonGradient({ id }: { id: string }) {
  // Helleres, sattes Gelb für gute Sichtbarkeit.
  return (
    <radialGradient id={id} cx="0.4" cy="0.4" r="0.7">
      <stop offset="0%" stopColor="#FEF3C7" stopOpacity="1" />
      <stop offset="100%" stopColor="#FCD34D" stopOpacity="1" />
    </radialGradient>
  );
}

function CloudShape({ fill, x = 0, y = 0, scale = 1, shadow = true }: { fill: string; x?: number; y?: number; scale?: number; shadow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M16 38 Q9 38 9 31 Q9 25 15 24 Q16 17 24 17 Q31 17 33 23 Q36 21 40 22 Q47 23 47 30 Q53 31 53 36 Q53 41 47 41 L17 41 Q16 41 16 38 Z"
        fill={fill}
        stroke="#4B5563"
        strokeWidth={0.75}
        style={shadow ? { filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.15))" } : undefined}
      />
    </g>
  );
}

/* ---------- icons ---------- */

function Sun({ size, uid, className }: Base) {
  const g = `sunGrad_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <SunGradient id={g} />
      </defs>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 32 + Math.cos(a) * 18;
        const y1 = 32 + Math.sin(a) * 18;
        const x2 = 32 + Math.cos(a) * 26;
        const y2 = 32 + Math.sin(a) * 26;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" />;
      })}
      <circle cx={32} cy={32} r={13} fill={`url(#${g})`} />
      <ellipse cx={27} cy={27} rx={4} ry={2.5} fill="rgba(255,255,255,0.55)" />
    </Frame>
  );
}

function MainlySunny({ size, uid, className }: Base) {
  const sg = `sunGrad_${uid}`;
  const cg = `cloudGrad_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <SunGradient id={sg} />
        <CloudGradient id={cg} />
      </defs>
      <circle cx={44} cy={22} r={9} fill={`url(#${sg})`} />
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i * Math.PI) / 3;
        const x1 = 44 + Math.cos(a) * 12;
        const y1 = 22 + Math.sin(a) * 12;
        const x2 = 44 + Math.cos(a) * 17;
        const y2 = 22 + Math.sin(a) * 17;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" />;
      })}
      <CloudShape fill={`url(#${cg})`} y={4} />
    </Frame>
  );
}

function PartlyCloudy({ size, uid, className }: Base) {
  const sg = `sunGrad_${uid}`;
  const cgF = `cloudGradF_${uid}`;
  const cgB = `cloudGradB_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <SunGradient id={sg} />
        <CloudGradient id={cgF} />
        <CloudGradient id={cgB} dark />
      </defs>
      <circle cx={45} cy={20} r={8} fill={`url(#${sg})`} />
      <CloudShape fill={`url(#${cgB})`} x={6} y={2} scale={0.75} />
      <CloudShape fill={`url(#${cgF})`} y={8} />
    </Frame>
  );
}

function Overcast({ size, uid, className }: Base) {
  const c1 = `cloudGrad1_${uid}`;
  const c2 = `cloudGrad2_${uid}`;
  const c3 = `cloudGrad3_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <CloudGradient id={c1} dark />
        <CloudGradient id={c2} />
        <CloudGradient id={c3} />
      </defs>
      <CloudShape fill={`url(#${c1})`} x={-4} y={-2} scale={0.85} />
      <CloudShape fill={`url(#${c2})`} x={10} y={2} scale={0.8} />
      <CloudShape fill={`url(#${c3})`} y={10} />
    </Frame>
  );
}

function Fog({ size, uid, className }: Base) {
  const cg = `cloudGrad_${uid}`;
  const fg = `fogGrad_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <CloudGradient id={cg} />
        <linearGradient id={fg} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(148,163,184,0)" />
          <stop offset="50%" stopColor="rgba(148,163,184,0.85)" />
          <stop offset="100%" stopColor="rgba(148,163,184,0)" />
        </linearGradient>
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-2} scale={0.9} />
      {[44, 49, 54, 58].map((y, i) => (
        <rect key={i} x={6 + (i % 2) * 3} y={y} width={52 - (i % 2) * 6} height={2} rx={1} fill={`url(#${fg})`} />
      ))}
    </Frame>
  );
}

function FreezingFog({ size, uid, className }: Base) {
  const cg = `cloudGrad_${uid}`;
  const fg = `fogGrad_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <CloudGradient id={cg} />
        <linearGradient id={fg} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(125,211,252,0)" />
          <stop offset="50%" stopColor="rgba(125,211,252,0.9)" />
          <stop offset="100%" stopColor="rgba(125,211,252,0)" />
        </linearGradient>
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-2} scale={0.9} />
      {[44, 49, 54, 58].map((y, i) => (
        <rect key={i} x={6 + (i % 2) * 3} y={y} width={52 - (i % 2) * 6} height={2} rx={1} fill={`url(#${fg})`} />
      ))}
      {[[14, 46], [28, 51], [44, 47], [22, 56], [40, 58]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={0.9} fill="#bae6fd" />
      ))}
    </Frame>
  );
}

function Drops({ count, color = "url(#dropG)", rotate = 10, big = false }: { count: number; color?: string; rotate?: number; big?: boolean }) {
  const positions = [12, 20, 28, 36, 44, 18, 32].slice(0, count);
  return (
    <g>
      {positions.map((x, i) => {
        const y = 46 + (i % 2) * 4;
        return (
          <ellipse
            key={i}
            cx={x + 4}
            cy={y}
            rx={big ? 1.6 : 1.2}
            ry={big ? 3.2 : 2.4}
            fill={color}
            transform={`rotate(${rotate} ${x + 4} ${y})`}
          />
        );
      })}
    </g>
  );
}

function Drizzle({ size, uid, className, drops, dark = false }: Base & { drops: number; dark?: boolean }) {
  const cg = `cloudGrad_${uid}`;
  const dg = `dropG_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <CloudGradient id={cg} dark={dark} />
        <DropGradient id={dg} />
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-4} />
      <Drops count={drops} color={`url(#${dg})`} rotate={10} />
    </Frame>
  );
}

function Rain({ size, uid, className, drops, heavy = false }: Base & { drops: number; heavy?: boolean }) {
  const cg = `cloudGrad_${uid}`;
  const dg = `dropG_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <CloudGradient id={cg} dark />
        <DropGradient id={dg} />
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-4} />
      <Drops count={drops} color={`url(#${dg})`} rotate={heavy ? 12 : 10} big={heavy} />
    </Frame>
  );
}

function IceCrosses({ positions }: { positions: number[][] }) {
  return (
    <g stroke="#a5f3fc" strokeWidth={1.2} strokeLinecap="round">
      {positions.map(([cx, cy], i) => (
        <g key={i}>
          <line x1={cx - 2} y1={cy} x2={cx + 2} y2={cy} />
          <line x1={cx} y1={cy - 2} x2={cx} y2={cy + 2} />
          <line x1={cx - 1.4} y1={cy - 1.4} x2={cx + 1.4} y2={cy + 1.4} />
          <line x1={cx + 1.4} y1={cy - 1.4} x2={cx - 1.4} y2={cy + 1.4} />
        </g>
      ))}
    </g>
  );
}

function FreezingDrizzle({ size, uid, className }: Base) {
  const cg = `cloudGrad_${uid}`;
  const dg = `dropG_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <linearGradient id={cg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <DropGradient id={dg} />
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-4} />
      <Drops count={3} color={`url(#${dg})`} rotate={8} />
      <IceCrosses positions={[[20, 52], [38, 50], [48, 56]]} />
    </Frame>
  );
}

function FreezingRain({ size, uid, className }: Base) {
  const cg = `cloudGrad_${uid}`;
  const dg = `dropG_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <linearGradient id={cg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#3730a3" />
        </linearGradient>
        <DropGradient id={dg} />
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-4} />
      <Drops count={4} color={`url(#${dg})`} rotate={10} big />
      <IceCrosses positions={[[16, 56], [44, 56]]} />
    </Frame>
  );
}

function Snow({ size, uid, className, flakes, big = false }: Base & { flakes: number; big?: boolean }) {
  const cg = `cloudGrad_${uid}`;
  const fg = `flakeGrad_${uid}`;
  const positions = [14, 22, 30, 38, 46, 18, 42].slice(0, flakes);
  const r = big ? 2.2 : 1.6;
  return (
    <Frame size={size} className={className}>
      <defs>
        <CloudGradient id={cg} />
        <radialGradient id={fg} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#bae6fd" />
        </radialGradient>
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-4} />
      {positions.map((x, i) => {
        const y = 48 + (i % 2) * 5;
        return (
          <g key={i}>
            <circle cx={x + 4} cy={y} r={r} fill={`url(#${fg})`} />
            <circle cx={x + 4 - r * 0.5} cy={y - r * 0.5} r={r * 0.35} fill="#ffffff" />
          </g>
        );
      })}
    </Frame>
  );
}

function SnowGrains({ size, uid, className }: Base) {
  const cg = `cloudGrad_${uid}`;
  const dg = `dropG_${uid}`;
  const fg = `flakeGrad_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <CloudGradient id={cg} />
        <DropGradient id={dg} />
        <radialGradient id={fg} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#bae6fd" />
        </radialGradient>
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-4} />
      <circle cx={18} cy={50} r={1.4} fill={`url(#${fg})`} />
      <circle cx={42} cy={52} r={1.4} fill={`url(#${fg})`} />
      <circle cx={30} cy={56} r={1.4} fill={`url(#${fg})`} />
      <ellipse cx={24} cy={54} rx={0.8} ry={2} fill={`url(#${dg})`} transform="rotate(15 24 54)" />
      <ellipse cx={48} cy={58} rx={0.8} ry={2} fill={`url(#${dg})`} transform="rotate(15 48 58)" />
    </Frame>
  );
}

function ShowerRain({ size, uid, className }: Base) {
  const sg = `sunGrad_${uid}`;
  const cg = `cloudGrad_${uid}`;
  const dg = `dropG_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <SunGradient id={sg} />
        <CloudGradient id={cg} dark />
        <DropGradient id={dg} />
      </defs>
      <circle cx={48} cy={16} r={7} fill={`url(#${sg})`} />
      <CloudShape fill={`url(#${cg})`} y={2} />
      <Drops count={3} color={`url(#${dg})`} rotate={12} />
    </Frame>
  );
}

function ShowerSnow({ size, uid, className }: Base) {
  const sg = `sunGrad_${uid}`;
  const cg = `cloudGrad_${uid}`;
  const fg = `flakeGrad_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <SunGradient id={sg} />
        <CloudGradient id={cg} />
        <radialGradient id={fg} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#bae6fd" />
        </radialGradient>
      </defs>
      <circle cx={48} cy={16} r={7} fill={`url(#${sg})`} />
      <CloudShape fill={`url(#${cg})`} y={2} />
      {[[20, 52], [32, 56], [42, 52]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={1.8} fill={`url(#${fg})`} />
          <circle cx={cx - 0.8} cy={cy - 0.8} r={0.6} fill="#fff" />
        </g>
      ))}
    </Frame>
  );
}

function Thunder({ size, uid, className }: Base) {
  const cg = `cloudGrad_${uid}`;
  const bg = `boltGrad_${uid}`;
  const blur = `glow_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <linearGradient id={cg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <filter id={blur} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-6} />
      <polygon
        points="32,40 24,54 30,54 26,62 38,48 32,48 36,40"
        fill={`url(#${bg})`}
        stroke="#facc15"
        strokeWidth={0.5}
        style={{ filter: `url(#${blur})` }}
      />
      <polygon points="32,40 24,54 30,54 26,62 38,48 32,48 36,40" fill={`url(#${bg})`} />
    </Frame>
  );
}

function ThunderHail({ size, uid, className }: Base) {
  const cg = `cloudGrad_${uid}`;
  const bg = `boltGrad_${uid}`;
  const blur = `glow_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <linearGradient id={cg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <filter id={blur} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>
      <CloudShape fill={`url(#${cg})`} y={-6} />
      <polygon
        points="32,38 24,52 30,52 26,60 38,46 32,46 36,38"
        fill={`url(#${bg})`}
        style={{ filter: `url(#${blur})` }}
      />
      <polygon points="32,38 24,52 30,52 26,60 38,46 32,46 36,38" fill={`url(#${bg})`} />
      {[[16, 54], [44, 52], [50, 58], [20, 60]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.6} fill="#c7d2fe" stroke="#4338ca" strokeWidth={0.6} />
      ))}
    </Frame>
  );
}

function Moon({ size, uid, className }: Base) {
  const mg = `moonGrad_${uid}`;
  const mask = `moonMask_${uid}`;
  const shadow = `moonShadow_${uid}`;
  // r=20 in 64-viewbox → Durchmesser 40 ≈ 62% der Icon-Größe.
  return (
    <Frame size={size} className={className}>
      <defs>
        <MoonGradient id={mg} />
        <mask id={mask}>
          <rect width="64" height="64" fill="black" />
          <circle cx={32} cy={32} r={20} fill="white" />
          <circle cx={40} cy={26} r={17} fill="black" />
        </mask>
        <filter id={shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${shadow})`}>
        <rect width="64" height="64" fill={`url(#${mg})`} mask={`url(#${mask})`} opacity="1" />
      </g>
      {[[10, 12], [56, 16], [8, 52], [54, 54]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.2} fill="#FCD34D" opacity="1" />
      ))}
    </Frame>
  );
}

function MoonLightCloud({ size, uid, className }: Base) {
  const mg = `moonGrad_${uid}`;
  const mask = `moonMask_${uid}`;
  const cg = `cloudGrad_${uid}`;
  const shadow = `moonShadow_${uid}`;
  // Mond dominant, kleine Wolke davor unten rechts.
  return (
    <Frame size={size} className={className}>
      <defs>
        <MoonGradient id={mg} />
        <CloudGradient id={cg} dark />
        <mask id={mask}>
          <rect width="64" height="64" fill="black" />
          <circle cx={28} cy={28} r={18} fill="white" />
          <circle cx={36} cy={22} r={15} fill="black" />
        </mask>
        <filter id={shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${shadow})`}>
        <rect width="64" height="64" fill={`url(#${mg})`} mask={`url(#${mask})`} opacity="1" />
      </g>
      <CloudShape fill={`url(#${cg})`} x={12} y={18} scale={0.6} />
    </Frame>
  );
}

function CloudyNight({ size, uid, className }: Base) {
  const mg = `moonGrad_${uid}`;
  const cg = `cloudGrad_${uid}`;
  const shadow = `moonShadow_${uid}`;
  return (
    <Frame size={size} className={className}>
      <defs>
        <MoonGradient id={mg} />
        <CloudGradient id={cg} dark />
        <filter id={shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      {/* Mond deutlich sichtbar, oben rechts */}
      <g filter={`url(#${shadow})`}>
        <circle cx={46} cy={18} r={10} fill={`url(#${mg})`} opacity="1" />
      </g>
      {/* Wolke davor, lässt Mond teilweise sichtbar */}
      <CloudShape fill={`url(#${cg})`} y={8} />
    </Frame>
  );
}
