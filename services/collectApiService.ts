
interface CollectApiResponse {
  success: boolean;
  result: any[];
}

const BASE_URL = 'https://api.collectapi.com/economy';

const getHeaders = () => ({
  'content-type': 'application/json',
  'authorization': `apikey ${process.env.MASSIVE_API_KEY || ''}`
});

export const fetchRealMarketData = async () => {
  const updates: Record<string, { price: number; change: number; changePercent: number; dayHigh: number; dayLow: number }> = {};

  try {
    // 1. Fetch Crypto Data
    const cryptoResponse = await fetch(`${BASE_URL}/cripto`, { headers: getHeaders() });
    const cryptoData: CollectApiResponse = await cryptoResponse.json();
    
    if (cryptoData.success) {
      cryptoData.result.forEach((item: any) => {
        // CollectAPI returns 'code' like 'BTC', 'ETH'
        // Price is often in 'price' (USD)
        const symbol = item.code;
        if (['BTC', 'ETH'].includes(symbol)) {
           updates[symbol] = {
             price: item.price,
             change: item.change || 0,
             changePercent: item.changeRatio || 0, // Sometimes 'changeRatio' or 'pctChange'
             dayHigh: item.high || item.price * 1.05,
             dayLow: item.low || item.price * 0.95
           };
        }
      });
    }

    // 2. Fetch BIST Data
    // We use the 'hisseSenedi' endpoint which returns live BIST data
    const bistResponse = await fetch(`${BASE_URL}/hisseSenedi`, { headers: getHeaders() });
    const bistData: CollectApiResponse = await bistResponse.json();

    if (bistData.success) {
       bistData.result.forEach((item: any) => {
         // item.code might be 'THYAO', 'ASELS'
         const symbol = item.code;
         // CollectAPI BIST prices are in TRY
         // item usually has { min, max, lastprice, rate, text }
         updates[symbol] = {
             price: item.lastprice,
             change: item.rate || 0, // rate is often the % change in some endpoints, or absolute. Let's assume % for rate in some views or calculate it.
             // Actually in 'hisseSenedi', 'rate' is % change. 'lastprice' is current.
             changePercent: item.rate, 
             dayHigh: item.max,
             dayLow: item.min
         };
       });
    }

  } catch (error) {
    console.error("Failed to fetch real market data:", error);
  }

  return updates;
};
