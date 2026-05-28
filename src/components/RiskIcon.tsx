/**
 * Duotone-Filled Icons für die 7 Wetter-Risiken.
 * Stil: gefüllte Wolke (~18% Opazität) als Basis, das charakteristische
 * Element (Blitz/Tropfen/Hagel/Wind/Schnee/Eis/Nebel) als kräftiger
 * Volltreffer in currentColor obendrauf. Optimiert für gute Sichtbarkeit
 * in Light- und Darkmode bei Größen 11–28 px.
 */
import type { JSX } from "react";

export type RiskIconId =
  | "gewitter"
  | "starkregen"
  | "hagel"
  | "sturm"
  | "schneesturm"
  | "glatteis"
  | "nebel"
  | "frost"
  | "hitze"
  | "uv";

interface RiskIconProps {
  id: RiskIconId;
  size?: number;
  color?: string;
}

// Großzügige, weiche Wolkenform
const CLOUD_D =
  "M7 17.5a4.5 4.5 0 0 1-.6-8.96 5.5 5.5 0 0 1 10.7-1.04A3.75 3.75 0 0 1 18 15H7z";

function RiskIcon({ id, size = 20, color = "currentColor" }: RiskIconProps): JSX.Element {
  const cloudFill = { fill: color, opacity: 0.22 };
  const solid = { fill: color };

  const renderInner = (): JSX.Element => {
    switch (id) {
      case "gewitter":
        return (
          <>
            <path d={CLOUD_D} {...cloudFill} />
            {/* Blitz */}
            <path d="M13.2 13l-3.4 5.4h2.4l-1 3.6 3.6-5.6h-2.4l.8-3.4z" {...solid} />
          </>
        );
      case "starkregen":
        return (
          <>
            <path d={CLOUD_D} {...cloudFill} />
            {/* 3 Tropfen */}
            <path d="M8.5 17.5c0 1-.7 1.6-1.5 1.6S5.5 18.5 5.5 17.5c0-.9 1.5-2.8 1.5-2.8s1.5 1.9 1.5 2.8z" {...solid} />
            <path d="M13 18.4c0 1-.7 1.6-1.5 1.6s-1.5-.6-1.5-1.6c0-.9 1.5-2.8 1.5-2.8s1.5 1.9 1.5 2.8z" {...solid} />
            <path d="M17.5 17.5c0 1-.7 1.6-1.5 1.6s-1.5-.6-1.5-1.6c0-.9 1.5-2.8 1.5-2.8s1.5 1.9 1.5 2.8z" {...solid} />
          </>
        );
      case "hagel":
        return (
          <>
            <path d={CLOUD_D} {...cloudFill} />
            <circle cx={8.5} cy={19} r={1.4} {...solid} />
            <circle cx={13} cy={20.2} r={1.4} {...solid} />
            <circle cx={17.5} cy={19} r={1.4} {...solid} />
          </>
        );
      case "sturm":
        return (
          <>
            {/* Drei kräftige Windschwünge */}
            <path
              d="M3 8h11.5a2.5 2.5 0 1 0-2.45-3M3 12h15a3 3 0 1 1-2.9 3.78M3 16h9.5a2 2 0 1 1-1.95 2.4"
              stroke={color}
              strokeWidth={2.2}
              strokeLinecap="round"
              fill="none"
            />
          </>
        );
      case "schneesturm":
        return (
          <>
            <path d={CLOUD_D} {...cloudFill} />
            {/* Drei Schneeflocken: zentraler Punkt + 6 Strahlen */}
            <g stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none">
              <g transform="translate(7.5 18.5)">
                <line x1={-1.8} y1={0} x2={1.8} y2={0} />
                <line x1={-0.9} y1={-1.55} x2={0.9} y2={1.55} />
                <line x1={-0.9} y1={1.55} x2={0.9} y2={-1.55} />
              </g>
              <g transform="translate(12 20)">
                <line x1={-1.8} y1={0} x2={1.8} y2={0} />
                <line x1={-0.9} y1={-1.55} x2={0.9} y2={1.55} />
                <line x1={-0.9} y1={1.55} x2={0.9} y2={-1.55} />
              </g>
              <g transform="translate(16.5 18.5)">
                <line x1={-1.8} y1={0} x2={1.8} y2={0} />
                <line x1={-0.9} y1={-1.55} x2={0.9} y2={1.55} />
                <line x1={-0.9} y1={1.55} x2={0.9} y2={-1.55} />
              </g>
            </g>
          </>
        );
      case "glatteis":
        return (
          <>
            {/* Thermometer-Bulb (duotone) */}
            <path
              d="M10.5 5.5a1.5 1.5 0 0 1 3 0v9.2a3 3 0 1 1-3 0V5.5z"
              fill={color}
              opacity={0.22}
            />
            {/* Quecksilbersäule + Bulb solid */}
            <circle cx={12} cy={17.5} r={2.4} {...solid} />
            <rect x={11.25} y={8} width={1.5} height={8} rx={0.75} {...solid} />
            {/* Schneeflocke oben rechts */}
            <g stroke={color} strokeWidth={1.7} strokeLinecap="round" fill="none">
              <line x1={18.5} y1={5} x2={18.5} y2={10} />
              <line x1={16} y1={7.5} x2={21} y2={7.5} />
              <line x1={16.8} y1={5.8} x2={20.2} y2={9.2} />
              <line x1={20.2} y1={5.8} x2={16.8} y2={9.2} />
            </g>
          </>
        );
      case "nebel":
        return (
          <>
            <path d={CLOUD_D} {...cloudFill} />
            {/* Nebelschwaden */}
            <g stroke={color} strokeWidth={2} strokeLinecap="round" fill="none">
              <line x1={5} y1={18} x2={15} y2={18} />
              <line x1={8} y1={21} x2={19} y2={21} />
            </g>
          </>
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {renderInner()}
    </svg>
  );
}

export default RiskIcon;
