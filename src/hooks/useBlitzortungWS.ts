import { useCallback, useEffect, useRef, useState } from "react";
import { lzwDecode, parseStrike, type BlitzStrike } from "@/lib/blitzortungDecoder";

const ENDPOINTS = [
  "wss://ws1.blitzortung.org",
  "wss://ws7.blitzortung.org",
  "wss://ws8.blitzortung.org",
];

const MAX_AGE_MS = 30 * 60 * 1000;
const RECONNECT_DELAY = 3000;
const MAX_FAILS = 3;

export interface UseBlitzortungResult {
  strikes: BlitzStrike[];
  isConnected: boolean;
  failed: boolean;
  strikesLast10Min: number;
  reconnect: () => void;
}

export function useBlitzortungWS(enabled = true): UseBlitzortungResult {
  const [strikes, setStrikes] = useState<BlitzStrike[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [failed, setFailed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const failsRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualRetry = useRef(0);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    if (document.hidden) return;

    const url = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      failsRef.current += 1;
      if (failsRef.current >= MAX_FAILS) setFailed(true);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setFailed(false);
      failsRef.current = 0;
      try {
        ws.send(JSON.stringify({ a: 111 }));
      } catch {
        /* noop */
      }
      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ a: 0 }));
          } catch {
            /* noop */
          }
        }
      }, 30_000);
    };

    ws.onmessage = (ev) => {
      try {
        const decoded = lzwDecode(String(ev.data));
        const strike = parseStrike(decoded);
        if (!strike) return;
        setStrikes((prev) => {
          const cutoff = Date.now() - MAX_AGE_MS;
          const next = prev.filter((s) => s.time >= cutoff);
          next.push(strike);
          return next;
        });
      } catch {
        /* ignore */
      }
    };

    const handleDown = () => {
      setIsConnected(false);
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
      failsRef.current += 1;
      if (failsRef.current >= MAX_FAILS + manualRetry.current * MAX_FAILS) {
        setFailed(true);
        return;
      }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onclose = handleDown;
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };
  }, []);

  const teardown = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    manualRetry.current += 1;
    failsRef.current = 0;
    setFailed(false);
    teardown();
    connect();
  }, [connect, teardown]);

  useEffect(() => {
    if (!enabled) return;
    connect();

    const onVis = () => {
      if (document.hidden) {
        teardown();
      } else if (!wsRef.current) {
        failsRef.current = 0;
        setFailed(false);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      teardown();
    };
  }, [enabled, connect, teardown]);

  // Periodic cleanup of old strikes
  useEffect(() => {
    const t = setInterval(() => {
      const cutoff = Date.now() - MAX_AGE_MS;
      setStrikes((prev) => {
        const filtered = prev.filter((s) => s.time >= cutoff);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const strikesLast10Min = strikes.reduce((acc, s) => (s.time >= tenMinAgo ? acc + 1 : acc), 0);

  return { strikes, isConnected, failed, strikesLast10Min, reconnect };
}
