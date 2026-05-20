// Reusable Redis cache helper with stale-while-revalidate support.
// All operations are wrapped in try/catch — a cache failure must never
// kill the request.
import { Redis } from '@upstash/redis';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      console.warn('[cache] KV env vars missing — cache disabled');
      _redis = null;
      return null;
    }
    _redis = new Redis({ url, token });
    return _redis;
  } catch (e) {
    console.warn('[cache] failed to init Redis client', e);
    _redis = null;
    return null;
  }
}

export async function getCached<T = unknown>(
  key: string,
): Promise<CacheEntry<T> | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get<CacheEntry<T> | string>(key);
    if (!v) return null;
    // Upstash auto-parses JSON if stored as JSON; tolerate both shapes
    if (typeof v === 'string') {
      try {
        return JSON.parse(v) as CacheEntry<T>;
      } catch {
        return null;
      }
    }
    if (typeof v === 'object' && v && 'data' in (v as any) && 'timestamp' in (v as any)) {
      return v as CacheEntry<T>;
    }
    return null;
  } catch (e) {
    console.warn('[cache] get failed', key, e);
    return null;
  }
}

export async function setCached<T = unknown>(
  key: string,
  data: T,
  ttlSeconds: number = 24 * 60 * 60,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await r.set(key, JSON.stringify(entry), { ex: ttlSeconds });
  } catch (e) {
    console.warn('[cache] set failed', key, e);
  }
}

export function isFresh(timestamp: number, freshMs: number = 30 * 60 * 1000): boolean {
  return Date.now() - timestamp < freshMs;
}

export function isStaleButUsable(
  timestamp: number,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): boolean {
  const age = Date.now() - timestamp;
  return age >= 0 && age < maxAgeMs;
}

export function ageMinutes(timestamp: number): number {
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}
