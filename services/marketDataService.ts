import { Stock, NewsItem } from '../types';
import { SNAPSHOT_NASDAQ_DATA, SNAPSHOT_BIST_DATA, SNAPSHOT_CRYPTO_DATA } from './snapshotData';

const generateIntradayCurve = (current: number, high: number, low: number) => {
    const points = 48;
    const data = [];
    const now = new Date();
    let virtualPrice = (high + low) / 2;
    for (let i = 0; i < points; i++) {
        const date = new Date(now);
        date.setMinutes(date.getMinutes() - ((points - i) * 30));
        const change = (Math.random() - 0.5) * (high - low) * 0.2;
        virtualPrice += change;
        if (virtualPrice > high) virtualPrice = high;
        if (virtualPrice < low) virtualPrice = low;
        if (i === points - 1) virtualPrice = current;
        data.push({
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: virtualPrice
        });
    }
    return data;
};

const SNAPSHOT_CRYPTO: Stock[] = SNAPSHOT_CRYPTO_DATA.map(x => ({
    symbol: x.s, name: x.n, price: x.p, change: (x.p * x.c)/100, changePercent: x.c,
    volume: '$24.5B', marketCap: '$1.2T', sector: 'Crypto', market: 'CRYPTO' as const,
    dayHigh: x.p * 1.05, dayLow: x.p * 0.95,
    logo: `https://assets.coincap.io/assets/icons/${x.s.toLowerCase()}@2x.png`,
    data: generateIntradayCurve(x.p, x.p*1.05, x.p*0.95)
}));

const SNAPSHOT_BIST: Stock[] = SNAPSHOT_BIST_DATA.map(x => ({
    symbol: x.s, name: x.n, price: x.p, change: (x.p * x.c)/100, changePercent: x.c,
    volume: '2.5B TRY', marketCap: '400B TRY', sector: 'BIST', market: 'BIST' as const,
    dayHigh: x.p * 1.02, dayLow: x.p * 0.98,
    logo: `https://ui-avatars.com/api/?name=${x.s}&background=random&color=fff&size=128&rounded=true`,
    data: generateIntradayCurve(x.p, x.p*1.02, x.p*0.98)
}));

const SNAPSHOT_NASDAQ: Stock[] = SNAPSHOT_NASDAQ_DATA.map(x => ({
    symbol: x.s, name: x.n, price: x.p, change: (x.p * x.c)/100, changePercent: x.c,
    volume: '50M', marketCap: '$2T', sector: 'US Market', market: 'NASDAQ' as const,
    dayHigh: x.p * 1.05, dayLow: x.p * 0.95,
    logo: `https://assets.parqet.com/logos/symbol/${x.s}?format=png`,
    data: generateIntradayCurve(x.p, x.p*1.05, x.p*0.95)
}));

const fetchWithTimeout = async (url: string, timeoutMs = 60000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
};

const fetchEndpoint = async <T>(endpoint: string, fallback: T, timeoutMs = 60000): Promise<T> => {
    try {
        console.log(`[Fetching] ${endpoint}...`);
        const res = await fetchWithTimeout(`/api/${endpoint}`, timeoutMs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            console.log(`[OK] ${endpoint}: ${data.length} items`);
            return data as T;
        }
        throw new Error('Empty response');
    } catch (err) {
        console.warn(`[Fallback] ${endpoint}:`, err);
        return fallback;
    }
};

export const fetchNews = async (): Promise<NewsItem[]> => {
    return fetchEndpoint<NewsItem[]>('news', []);
};

export const fetchAllMarketData = async () => {
    const [crypto, nasdaq, bist, news] = await Promise.all([
        fetchEndpoint<Stock[]>('crypto', SNAPSHOT_CRYPTO, 90000),
        fetchEndpoint<Stock[]>('nasdaq', SNAPSHOT_NASDAQ, 120000),
        fetchEndpoint<Stock[]>('bist', SNAPSHOT_BIST, 120000),
        fetchEndpoint<NewsItem[]>('news', [], 30000),
    ]);

    const allRaw = [...crypto, ...nasdaq, ...bist];

    const uniqueMap = new Map();
    allRaw.forEach(stock => {
        if (stock && stock.symbol && !uniqueMap.has(stock.symbol)) {
            uniqueMap.set(stock.symbol, stock);
        }
    });

    return {
        stocks: Array.from(uniqueMap.values()),
        news
    };
};
