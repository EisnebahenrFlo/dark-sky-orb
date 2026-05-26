/**
 * Stroke-basierte SVG-Icons für die 7 Wetter-Risiken.
 * Stil orientiert sich an WeatherIcon.tsx (strokeWidth 1.6, fill="none").
 */
import type { JSX } from "react";

export type RiskIconId =
  | "gewitter"
  | "starkregen"
  | "hagel"
  | "sturm"
  | "schneesturm"
  | "glatteis"
  | "nebel";

interface RiskIconProps {
  id: RiskIconId;
  size?: number;
  color?: string;
}

const CLOUD_D = "M6 16a4 4 0 0 1-.5-8 5 5 0 0 1 9.9-1A3 3 0 0 1 18 13H6z";

function RiskIcon({ id, size = 20, color = "currentColor" }: RiskIconProps): JSX.Element {
  const common = {
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const,
  };

  const renderInner = (): JSX.Element => {
    switch (id) {
      case "gewitter":
        return (
          <>
            <path d={CLOUD_D} {...common} />
            <polygon points="13,11 11,15 13,15 11,19" fill={color} stroke="none" />
          </>
        );
      case "starkregen":
        return (
          <>
            <path d={CLOUD_D} {...common} />
            <line x1={9} y1={17} x2={7} y2={21} {...common} />
            <line x1={13} y1={17} x2={11} y2={21} {...common} />
            <line x1={17} y1={17} x2={15} y2={21} {...common} />
          </>
        );
      case "hagel":
        return (
          <>
            <path d={CLOUD_D} {...common} />
            <circle cx={9} cy={20} r={1} fill={color} stroke="none" />
            <circle cx={13} cy={20} r={1} fill={color} stroke="none" />
            <circle cx={17} cy={20} r={1} fill={color} stroke="none" />
          </>
        );
      case "sturm":
        return (
          <>
            <path d="M3 8 Q7 5 11 8 Q15 11 19 8" {...common} />
            <path d="M3 12 Q7 9 11 12 Q15 15 19 12" {...common} />
            <path d="M3 16 Q8 13 12 16" {...common} />
          </>
        );
      case "schneesturm":
        return (
          <>
            {/* 4 Achsen */}
            <line x1={12} y1={6} x2={12} y2={18} {...common} />
            <line x1={6} y1={12} x2={18} y2={12} {...common} />
            <line x1={7.8} y1={7.8} x2={16.2} y2={16.2} {...common} />
            <line x1={16.2} y1={7.8} x2={7.8} y2={16.2} {...common} />
            {/* 8 Endpunkt-Ticks (≈1.5px) */}
            <line x1={11} y1={6} x2={13} y2={6} {...common} />
            <line x1={11} y1={18} x2={13} y2={18} {...common} />
            <line x1={6} y1={11} x2={6} y2={13} {...common} />
            <line x1={18} y1={11} x2={18} y2={13} {...common} />
            <line x1={7.1} y1={8.5} x2={8.5} y2={7.1} {...common} />
            <line x1={15.5} y1={16.9} x2={16.9} y2={15.5} {...common} />
            <line x1={15.5} y1={7.1} x2={16.9} y2={8.5} {...common} />
            <line x1={7.1} y1={15.5} x2={8.5} y2={16.9} {...common} />
          </>
        );
      case "glatteis":
        return (
          <>
            <circle cx={12} cy={17} r={2.5} {...common} />
            <line x1={12} y1={6} x2={12} y2={14.5} {...common} />
            <rect x={10.5} y={6} width={3} height={8.5} rx={1.5} {...common} />
            <line x1={17} y1={5} x2={21} y2={9} {...common} />
            <line x1={21} y1={5} x2={17} y2={9} {...common} />
          </>
        );
      case "nebel":
        return (
          <>
            <line x1={3} y1={9} x2={21} y2={9} {...common} />
            <line x1={3} y1={13} x2={19} y2={13} {...common} />
            <line x1={3} y1={17} x2={15} y2={17} {...common} />
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
