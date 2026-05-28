import { useCallback, useEffect, useRef, useState } from "react";
import { lzwDecode, parseStrike, type BlitzStrike } from "@/lib/blitzortungDecoder";

// All known Blitzortung public WS endpoints. We open ALL of them in parallel
// because individual servers stream slightly different subsets of strikes
// (different aggregator nodes). Deduplication happens client-side. In practice
// this multiplies the number of visible strikes ~2-3x in DACH/Italy.
const ENDPOINTS = [
  "wss://ws1.blitzortung.org",
  "wss://ws7.blitzortung.org",
  "wss://ws8.blitzortung.org",
];

// Region of interest: DACH + Italy. Strikes outside this bbox are dropped on
// arrival to keep the in-memory list small and the map readable.
const REGION = {
  latMin: 35,
  latMax: 56,
  lonMin: 5,
  lonMax: 19,
};

const MAX_AGE_MS = 30 * 60 * 1000;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30_000;

export interface UseBlitzortungResult {
  strikes: BlitzStrike[];
  /** true if at least one endpoint is connected */
  isConnected: boolean;
  /** how many of the endpoints are live */
  connectedCount: number;
  /** total endpoints we try to keep open */
  endpointCount: number;
  /** true if ALL endpoints failed permanently */
  failed: boolean;
  strikesLast10Min: number;
  reconnect: () => void;
}

interface Conn {
  ws: WebSocket | null;
  fails: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  url: string;
}

const inRegion = (lat: number, lon: number) =>
  lat >= REGION.latMin &&
  lat <= REGION.latMax &&
  lon >= REGION.lonMin &&
  lon <= REGION.lonMax;

// Strike fingerprint for cross-endpoint deduplication. Time is rounded to
// 100 ms because different servers can report the same strike with sub-ms
// drift; coords rounded to 4 decimals (~11 m) to absorb sensor jitter.
const fingerprint = (s: BlitzStrike) =>
  `${Math.round(s.time / 100)}_${s.lat.toFixed(4)}_${s.lon.toFixed(4)}`;

export function useBlitzortungWS(enabled = true): UseBlitzortungResult {
  const [strikes, setStrikes] = useState<BlitzStrike[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [failed, setFailed] = useState(false);

  const connsRef = useRef<Conn[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const manualRetryRef = useRef(0);

  const updateConnected = useCallback(() => {
    const live = connsRef.current.filter((c) => c.ws?.readyState === WebSocket.OPEN).length;
    setConnectedCount(live);
    if (live > 0) setFailed(false);
  }, []);

  const connectOne = useCallback(
    (idx: number) => {
      if (typeof window === "undefined") return;
      if (document.hidden) return;

      const conn = connsRef.current[idx];
      if (!conn) return;

      let ws: WebSocket;
      try {
        ws = new WebSocket(conn.url);
        ws.binaryType = "arraybuffer";
      } catch {
        conn.fails += 1;
        scheduleReconnect(idx);
        return;
      }
      conn.ws = ws;

      ws.onopen = () => {
        conn.fails = 0;
        updateConnected();
        try {
          ws.send(JSON.stringify({ a: 111 }));
        } catch {
          /* noop */
        }
      };

      ws.onmessage = (ev) => {
        try {
          let raw = "";
          if (typeof ev.data === "string") {
            raw = ev.data;
          } else if (ev.data instanceof ArrayBuffer) {
            const bytes = new Uint8Array(ev.data);
            let s = "";
            for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
            raw = s;
          }
          if (!raw) return;
          const decoded = lzwDecode(raw);
          const strike = parseStrike(decoded);
          if (!strike) return;
          if (!inRegion(strike.lat, strike.lon)) return;
          const fp = fingerprint(strike);
          if (seenRef.current.has(fp)) return;
          seenRef.current.add(fp);

          setStrikes((prev) => {
            const cutoff = Date.now() - MAX_AGE_MS;
            const next = prev.filter((s) => s.time >= cutoff);
            next.push(strike);
            return next;
          });
        } catch {
          /* swallow decode errors */
        }
      };

      const handleDown = () => {
        updateConnected();
        conn.fails += 1;
        scheduleReconnect(idx);
      };

      ws.onclose = handleDown;
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };
    },
    [updateConnected],
  );

  const scheduleReconnect = useCallback(
    (idx: number) => {
      const conn = connsRef.current[idx];
      if (!conn) return;
      if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
      // Exponential backoff per endpoint, capped. Each endpoint reconnects
      // independently so one slow endpoint never blocks the others.
      const delay = Math.min(
        RECONNECT_MAX_MS,
        RECONNECT_BASE_MS * Math.pow(1.7, Math.min(conn.fails, 6)),
      );
      conn.reconnectTimer = setTimeout(() => connectOne(idx), delay);

      // If every endpoint has failed many times, mark the whole hook failed.
      const allFailed = connsRef.current.every((c) => c.fails >= 5);
      if (allFailed) setFailed(true);
    },
    [connectOne],
  );

  const teardownOne = useCallback((idx: number) => {
    const conn = connsRef.current[idx];
    if (!conn) return;
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    if (conn.ws) {
      try {
        conn.ws.onclose = null;
        conn.ws.onerror = null;
        conn.ws.onmessage = null;
        conn.ws.onopen = null;
        conn.ws.close();
      } catch {
        /* noop */
      }
      conn.ws = null;
    }
  }, []);

  const teardownAll = useCallback(() => {
    for (let i = 0; i < connsRef.current.length; i++) teardownOne(i);
    setConnectedCount(0);
  }, [teardownOne]);

  const reconnect = useCallback(() => {
    manualRetryRef.current += 1;
    setFailed(false);
    seenRef.current.clear();
    teardownAll();
    // Re-init refs and reopen all
    connsRef.current = ENDPOINTS.map((url) => ({
      ws: null,
      fails: 0,
      reconnectTimer: null,
      url,
    }));
    connsRef.current.forEach((_, i) => connectOne(i));
  }, [teardownAll, connectOne]);

  useEffect(() => {
    if (!enabled) return;

    connsRef.current = ENDPOINTS.map((url) => ({
      ws: null,
      fails: 0,
      reconnectTimer: null,
      url,
    }));
    connsRef.current.forEach((_, i) => connectOne(i));

    const onVis = () => {
      if (document.hidden) {
        teardownAll();
      } else {
        // Reopen any closed connections without touching open ones
        connsRef.current.forEach((c, i) => {
          if (!c.ws || c.ws.readyState === WebSocket.CLOSED) {
            c.fails = 0;
            connectOne(i);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      teardownAll();
    };
  }, [enabled, connectOne, teardownAll]);

  // Periodic cleanup of old strikes + seen fingerprints
  useEffect(() => {
    const t = setInterval(() => {
      const cutoff = Date.now() - MAX_AGE_MS;
      setStrikes((prev) => {
        const filtered = prev.filter((s) => s.time >= cutoff);
        return filtered.length === prev.length ? prev : filtered;
      });
      // Prune fingerprints older than MAX_AGE by simply resetting if it grows
      // too large — fingerprints don't carry timestamps. 50k entries ~ a few
      // hundred KB and is plenty of headroom.
      if (seenRef.current.size > 50_000) seenRef.current.clear();
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const strikesLast10Min = strikes.reduce(
    (acc, s) => (s.time >= tenMinAgo ? acc + 1 : acc),
    0,
  );

  return {
    strikes,
    isConnected: connectedCount > 0,
    connectedCount,
    endpointCount: ENDPOINTS.length,
    failed,
    strikesLast10Min,
    reconnect,
  };
}
