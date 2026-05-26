import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.OPEN_METEO_API_KEY;
  const baseUrl = apiKey
    ? 'https://customer-api.open-meteo.com/v1'
    : 'https://api.open-meteo.com/v1';

  const url = new URL(req.url ?? '/', 'http://localhost');
  url.searchParams.delete('endpoint');
  if (apiKey) url.searchParams.set('apikey', apiKey);

  const upstreamUrl = `${baseUrl}/forecast?${url.searchParams.toString()}`;

  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const upstream = await fetch(upstreamUrl);
      if (upstream.ok) {
        const data = await upstream.json();
        return res.status(200).json(data);
      }
      if (upstream.status === 429 || upstream.status === 502) {
        await new Promise(r => setTimeout(r, attempt * 1000));
        continue;
      }
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (e: any) {
      lastError = e;
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  return res.status(500).json({ error: String(lastError?.message ?? 'failed') });
}
