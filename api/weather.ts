import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const params = new URLSearchParams(req.query as Record<string, string>);
  const apiKey = process.env.OPEN_METEO_API_KEY;
  if (apiKey) params.append('apikey', apiKey);
  
  const baseUrl = apiKey
    ? 'https://customer-api.open-meteo.com/v1'
    : 'https://api.open-meteo.com/v1';

  const endpoint = (req.query.endpoint as string) || 'forecast';
  params.delete('endpoint');

  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const upstream = await fetch(`${baseUrl}/${endpoint}?${params.toString()}`);
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
  res.status(500).json({ error: String(lastError?.message ?? 'failed') });
}
