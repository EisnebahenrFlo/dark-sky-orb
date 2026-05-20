import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCached, setCached, isFresh, isStaleButUsable, ageMinutes } from './_lib/cache.js';

type ErrorCode = 'TIMEOUT' | 'RATE_LIMIT' | 'API_ERROR' | 'PARSE_ERROR' | 'BAD_REQUEST';

function errorResponse(
  res: VercelResponse,
  status: number,
  code: ErrorCode,
  error: string,
  details?: string,
) {
  return res.status(status).json({ error, code, ...(details ? { details } : {}) });
}

const RETRY_DELAYS_MS = [500, 1500, 4500];
const REQUEST_TIMEOUT_MS = 30_000;
const FRESH_MS = 5 * 60 * 1000;
const STALE_MAX_MS = 60 * 60 * 1000;
const CACHE_KEY = 'rainbow:snapshot';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Frame {
  time: number;
  offset: number;
  isPast: boolean;
}

interface RainbowSnapshot {
  snapshot: number;
  past: Frame[];
  nowcast: Frame[];
}

async function fetchRainbowSnapshotWithRetry(): Promise<
  | { ok: true; data: RainbowSnapshot }
  | { ok: false; code: ErrorCode; status: number; details: string }
> {
  let lastErr: { code: ErrorCode; status: number; details: string } = {
    code: 'API_ERROR',
    status: 500,
    details: 'unknown',
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(
        'https://api.rainbow.ai/tiles/v1/snapshot?layer=precip',
        {
          headers: { 'x-api-key': process.env.RAINBOW_API_KEY ?? '' },
          signal: controller.signal,
        },
      );
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json: any = await resp.json();
        // Tolerate different shapes — extract snapshot timestamp (seconds)
        const snapshot =
          typeof json?.snapshot === 'number'
            ? json.snapshot
            : typeof json?.snapshot === 'string'
              ? Number(json.snapshot)
              : typeof json?.timestamp === 'number'
                ? json.timestamp
                : NaN;

        if (!Number.isFinite(snapshot) || snapshot <= 0) {
          return {
            ok: false,
            code: 'PARSE_ERROR',
            status: 502,
            details: 'snapshot missing in response',
          };
        }

        const past: Frame[] = [];
        for (let offset = -7200; offset <= 0; offset += 600) {
          past.push({ time: snapshot + offset, offset, isPast: true });
        }
        const nowcast: Frame[] = [];
        for (let offset = 600; offset <= 14400; offset += 600) {
          nowcast.push({ time: snapshot + offset, offset, isPast: false });
        }
        return { ok: true, data: { snapshot, past, nowcast } };
      }

      const text = await resp.text();
      const status = resp.status;
      const retryable = status === 429 || status >= 500;
      const code: ErrorCode = status === 429 ? 'RATE_LIMIT' : 'API_ERROR';
      lastErr = { code, status, details: text.slice(0, 500) };
      if (!retryable) return { ok: false, ...lastErr };
      console.warn('[rainbow-snapshot] retry', attempt, status);
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isTimeout = e?.name === 'AbortError';
      lastErr = {
        code: isTimeout ? 'TIMEOUT' : 'API_ERROR',
        status: isTimeout ? 504 : 500,
        details: String(e?.message ?? e),
      };
      console.warn('[rainbow-snapshot] retry', attempt, isTimeout ? 'TIMEOUT' : 'NETWORK');
    }
    if (attempt < 3) await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }

  return { ok: false, ...lastErr };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')
    return errorResponse(res, 405, 'BAD_REQUEST', 'Method not allowed');

  const cached = await getCached<RainbowSnapshot>(CACHE_KEY);
  if (cached && isFresh(cached.timestamp, FRESH_MS)) {
    return res.status(200).json({
      ...cached.data,
      cached: true,
      fromCache: true,
      stale: false,
      cacheAge: ageMinutes(cached.timestamp),
    });
  }

  const result = await fetchRainbowSnapshotWithRetry();

  if (!result.ok) {
    console.error('[rainbow-snapshot] fetch failed', result);
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      return res.status(200).json({
        ...cached.data,
        cached: true,
        fromCache: true,
        stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }
    const userMsg =
      result.code === 'TIMEOUT'
        ? 'Rainbow.ai Zeitüberschreitung'
        : result.code === 'RATE_LIMIT'
          ? 'Rainbow.ai überlastet'
          : 'Rainbow.ai fehlgeschlagen';
    return errorResponse(res, result.status, result.code, userMsg, result.details);
  }

  await setCached(CACHE_KEY, result.data, 60 * 60);
  return res
    .status(200)
    .json({ ...result.data, cached: false, fromCache: false, stale: false });
}
