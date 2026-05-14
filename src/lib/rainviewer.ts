export interface RainViewerFrame {
  time: number;
  path: string;
}

export interface RainViewerData {
  past: RainViewerFrame[];
  nowcast: RainViewerFrame[];
  host: string;
}

interface RainViewerResponse {
  host: string;
  radar: { past: RainViewerFrame[]; nowcast: RainViewerFrame[] };
}

export async function fetchRainViewer(): Promise<RainViewerData> {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!res.ok) throw new Error("RainViewer fehlgeschlagen");
  const data = (await res.json()) as RainViewerResponse;
  return {
    host: data.host,
    past: data.radar.past,
    nowcast: data.radar.nowcast,
  };
}

export function frameTileUrl(host: string, frame: RainViewerFrame): string {
  return `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}
