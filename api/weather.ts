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

  try {
    const upstream = await fetch(`${baseUrl}/${endpoint}?${params.toString()}`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e: any) {
    res.status(500).json({ error: String(e.message) });
  }
}
