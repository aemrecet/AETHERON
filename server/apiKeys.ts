const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

interface ApiKeyRow {
  service_name: string;
  api_key: string;
  is_active: boolean;
}

let cachedKeys: Record<string, string> = {};
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchKeysFromDb(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/api_keys?is_active=eq.true&select=service_name,api_key`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows: ApiKeyRow[] = await res.json();
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[r.service_name] = r.api_key;
    });
    return map;
  } catch (err) {
    console.error('[apiKeys] Failed to fetch from DB, falling back to env:', err);
    return {};
  }
}

function getEnvFallback(): Record<string, string> {
  return {
    COINGECKO: process.env.COINGECKO_API_KEY || '',
    COINMARKETCAP: process.env.COINMARKETCAP_API_KEY || '',
    FINNHUB: process.env.FINNHUB_API_KEY || '',
    MASSIVE: process.env.MASSIVE_API_KEY || '',
    QUIVERQUANT: process.env.QUIVERQUANT_API_KEY || '',
    OPENAI: process.env.OPENAI_API_KEY || '',
    WHALEALERT: process.env.WHALEALERT_API_KEY || '',
    ETHERSCAN: process.env.ETHERSCAN_API_KEY || '',
    QUICKNODE: process.env.QUICKNODE_API_KEY || '',
    GEMINI: process.env.GEMINI_API_KEY || '',
  };
}

export async function getApiKey(serviceName: string): Promise<string> {
  const now = Date.now();
  if (now - lastFetch > CACHE_TTL || Object.keys(cachedKeys).length === 0) {
    const dbKeys = await fetchKeysFromDb();
    const envKeys = getEnvFallback();
    cachedKeys = { ...envKeys, ...dbKeys };
    lastFetch = now;
  }
  return cachedKeys[serviceName] || '';
}

export async function getAllApiKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - lastFetch > CACHE_TTL || Object.keys(cachedKeys).length === 0) {
    const dbKeys = await fetchKeysFromDb();
    const envKeys = getEnvFallback();
    cachedKeys = { ...envKeys, ...dbKeys };
    lastFetch = now;
  }
  return { ...cachedKeys };
}
