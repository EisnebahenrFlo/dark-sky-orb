// LZW decoder for Blitzortung.org websocket payloads.
// Based on the community decoder used in their public viewer.
export function lzwDecode(b: string): string {
  const d = b.split("");
  let c = d[0];
  let a = c;
  const f: string[] = [c];
  const o = 256;
  let n = o;
  const e: Record<number, string> = {};
  for (let i = 1; i < d.length; i++) {
    const code = d[i].charCodeAt(0);
    const g = o > code ? d[i] : e[code] ? e[code] : a + c;
    f.push(g);
    c = g.charAt(0);
    e[n] = a + c;
    n++;
    a = g;
  }
  return f.join("");
}

export interface BlitzStrike {
  time: number; // ms epoch
  lat: number;
  lon: number;
  pol?: number;
}

export function parseStrike(raw: string): BlitzStrike | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj.lat !== "number" || typeof obj.lon !== "number") return null;
    // time is in nanoseconds
    const ms = typeof obj.time === "number" ? Math.floor(obj.time / 1_000_000) : Date.now();
    return { time: ms, lat: obj.lat, lon: obj.lon, pol: obj.pol };
  } catch {
    return null;
  }
}
