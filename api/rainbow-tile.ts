import type { VercelRequest, VercelResponse } from '@vercel/node';

const REQUEST_TIMEOUT_MS = 15_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', code: 'BAD_REQUEST' });
  }

  const { snapshot, forecast_time, z, x, y, color = '1' } = req.query as Record<
    string,
    string
  >;

  if (!snapshot || forecast_time === undefined || !z || !x || !y) {
    return res
      .status(400)
      .json({ error: 'Missing required params', code: 'BAD_REQUEST' });
  }

  // Strip any potential file extensions (e.g. "1.png") for safety
  const yClean = String(y).replace(/\.[a-zA-Z0-9]+$/, '');

  const url = `https://api.rainbow.ai/tiles/v1/precip/${encodeURIComponent(
    snapshot,
  )}/${encodeURIComponent(forecast_time)}/${encodeURIComponent(z)}/${encodeURIComponent(
    x,
  )}/${encodeURIComponent(yClean)}?color=${encodeURIComponent(color)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      headers: { 'x-api-key': process.env.RAINBOW_API_KEY ?? '' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (upstream.status === 404) {
      res.setHeader('Cache-Control', 'public, max-age=600');
      return res.status(404).end();
    }

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.warn('[rainbow-tile] upstream error', upstream.status, text.slice(0, 200));
      return res
        .status(upstream.status)
        .json({ error: 'Rainbow tile error', code: 'API_ERROR' });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.status(200).send(buf);
  } catch (e: any) {
    clearTimeout(timeoutId);
    const isTimeout = e?.name === 'AbortError';
    console.warn('[rainbow-tile] fetch failed', isTimeout ? 'TIMEOUT' : 'NETWORK', e?.message);
    return res
      .status(isTimeout ? 504 : 500)
      .json({ error: 'Rainbow tile fetch failed', code: isTimeout ? 'TIMEOUT' : 'API_ERROR' });
  }
}
