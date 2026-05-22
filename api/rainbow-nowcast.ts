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

  const { lat, lon } = req.query as Record<string, string>;
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!lat || !lon || !Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return res
      .status(400)
      .json({ error: 'Missing or invalid lat/lon', code: 'BAD_REQUEST' });
  }

  const url = `https://api.rainbow.ai/nowcast/v1/precip-global/${encodeURIComponent(
    String(lonNum),
  )}/${encodeURIComponent(String(latNum))}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.RAINBOW_API_KEY ?? ''}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.warn(
        '[rainbow-nowcast] upstream error',
        upstream.status,
        text.slice(0, 200),
      );
      return res.status(502).json({ error: 'Nowcast nicht verfügbar' });
    }

    const json = await upstream.json();
    return res.status(200).json(json);
  } catch (e: any) {
    clearTimeout(timeoutId);
    console.warn('[rainbow-nowcast] fetch failed', e?.message);
    return res.status(502).json({ error: 'Nowcast nicht verfügbar' });
  }
}
