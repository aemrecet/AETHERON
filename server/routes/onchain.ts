import { Router } from 'express';
import { getApiKey } from '../apiKeys.js';

const router = Router();

const cgFetch = async (path: string, params: Record<string, string> = {}) => {
  const cgKey = await getApiKey('COINGECKO');
  const url = new URL(`https://api.coingecko.com/api/v3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (cgKey) url.searchParams.set('x_cg_demo_api_key', cgKey);
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CG ${res.status}`);
  return res.json();
};

router.get('/coin-list', async (_req, res) => {
  try {
    const data = await cgFetch('/coins/markets', {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: '50',
      page: '1',
    });
    const coins = (data || []).map((c: any) => ({
      symbol: c.symbol?.toUpperCase(),
      name: c.name,
      chain: 'multi',
      image: c.image,
      price: c.current_price,
      marketCap: c.market_cap,
      volume24h: c.total_volume,
      priceChange24h: c.price_change_percentage_24h,
    }));
    res.json(coins);
  } catch (err) {
    console.error('[onchain/coin-list]', err);
    res.json([]);
  }
});

router.get('/gas', async (_req, res) => {
  try {
    const ETHERSCAN_KEY = await getApiKey('ETHERSCAN');

    const [ethGasRes, bscGasRes, polygonGasRes] = await Promise.allSettled([
      fetch(`https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
      fetch(`https://api.etherscan.io/v2/api?chainid=56&module=gastracker&action=gasoracle&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
      fetch(`https://api.etherscan.io/v2/api?chainid=137&module=gastracker&action=gasoracle&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
    ]);

    const ethResult = ethGasRes.status === 'fulfilled' ? ethGasRes.value?.result || {} : {};
    const bscResult = bscGasRes.status === 'fulfilled' ? bscGasRes.value?.result || {} : {};
    const polygonResult = polygonGasRes.status === 'fulfilled' ? polygonGasRes.value?.result || {} : {};

    res.json({
      ethereum: {
        low: parseInt(ethResult.SafeGasPrice) || 12,
        standard: parseInt(ethResult.ProposeGasPrice) || 18,
        fast: parseInt(ethResult.FastGasPrice) || 25,
        instant: Math.round((parseInt(ethResult.FastGasPrice) || 25) * 1.4),
        baseFee: parseFloat(ethResult.suggestBaseFee) || 15,
      },
      bsc: {
        low: parseInt(bscResult.SafeGasPrice) || 3,
        standard: parseInt(bscResult.ProposeGasPrice) || 5,
        fast: parseInt(bscResult.FastGasPrice) || 7,
        instant: Math.round((parseInt(bscResult.FastGasPrice) || 7) * 1.4),
        baseFee: parseFloat(bscResult.suggestBaseFee) || 3.5,
      },
      polygon: {
        low: parseInt(polygonResult.SafeGasPrice) || 30,
        standard: parseInt(polygonResult.ProposeGasPrice) || 50,
        fast: parseInt(polygonResult.FastGasPrice) || 80,
        instant: Math.round((parseInt(polygonResult.FastGasPrice) || 80) * 1.4),
        baseFee: parseFloat(polygonResult.suggestBaseFee) || 35,
      },
      solana: { low: 0.000005, standard: 0.000005, fast: 0.00001, instant: 0.00005, baseFee: 0.000005 },
    });
  } catch (err) {
    console.error('[onchain/gas]', err);
    res.json({
      ethereum: { low: 12, standard: 18, fast: 25, instant: 35, baseFee: 15 },
      bsc: { low: 3, standard: 5, fast: 7, instant: 10, baseFee: 3.5 },
      polygon: { low: 30, standard: 50, fast: 80, instant: 120, baseFee: 35 },
      solana: { low: 0.000005, standard: 0.000005, fast: 0.00001, instant: 0.00005, baseFee: 0.000005 },
    });
  }
});

router.get('/top-wallets', async (_req, res) => {
  try {
    const ETHERSCAN_KEY = await getApiKey('ETHERSCAN');
    const ethRes = await fetch(
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balancemulti&address=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8,0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf,0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489,0x8103683202aa8DA10536036EDef04CDd865C225E&tag=latest&apikey=${ETHERSCAN_KEY}`
    );
    const ethData = await ethRes.json();

    const labels: Record<string, string> = {
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'WETH Contract',
      '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8': 'Binance Cold Wallet',
      '0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf': 'Bitfinex Hot Wallet',
      '0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489': 'Coinbase Wallet',
      '0x8103683202aa8DA10536036EDef04CDd865C225E': 'Kraken Exchange',
    };

    const ethPriceRes = await cgFetch('/simple/price', { ids: 'ethereum', vs_currencies: 'usd' });
    const ethPrice = ethPriceRes?.ethereum?.usd || 3500;

    const wallets = (ethData?.result || []).map((w: any) => {
      const balance = parseFloat(w.balance) / 1e18;
      return {
        address: `${w.account.slice(0, 6)}...${w.account.slice(-4)}`,
        addressFull: w.account,
        label: labels[w.account] || 'Unknown Wallet',
        chain: 'ethereum',
        balance,
        symbol: 'ETH',
        balanceUsd: balance * ethPrice,
        lastActive: 'Recent',
      };
    });

    res.json(wallets);
  } catch (err) {
    console.error('[onchain/top-wallets]', err);
    res.json([]);
  }
});

router.get('/whale-alerts', async (req, res) => {
  try {
    const WHALEALERT_KEY = await getApiKey('WHALEALERT');
    const minValue = parseInt(req.query.minValue as string) || 500000;
    const now = Math.floor(Date.now() / 1000);
    const start = now - 3600;

    const waRes = await fetch(
      `https://api.whale-alert.io/v1/transactions?api_key=${WHALEALERT_KEY}&min_value=${minValue}&start=${start}&limit=20`
    );
    const waData = await waRes.json();

    const transactions = (waData?.transactions || []).map((tx: any) => ({
      hash: tx.hash || '',
      hashShort: tx.hash ? `${tx.hash.slice(0, 8)}...${tx.hash.slice(-6)}` : '',
      blockchain: tx.blockchain || '',
      chain: tx.blockchain || '',
      symbol: tx.symbol?.toUpperCase() || '',
      amount: tx.amount || 0,
      amountUsd: tx.amount_usd || 0,
      from: tx.from?.address ? `${tx.from.address.slice(0, 6)}...${tx.from.address.slice(-4)}` : 'Unknown',
      fromFull: tx.from?.address || '',
      fromType: tx.from?.owner_type || 'unknown',
      fromLabel: tx.from?.owner || null,
      to: tx.to?.address ? `${tx.to.address.slice(0, 6)}...${tx.to.address.slice(-4)}` : 'Unknown',
      toFull: tx.to?.address || '',
      toType: tx.to?.owner_type || 'unknown',
      toLabel: tx.to?.owner || null,
      timestamp: (tx.timestamp || 0) * 1000,
      type: tx.transaction_type || 'transfer',
      source: 'WhaleAlert',
    }));

    res.json({ transactions });
  } catch (err) {
    console.error('[onchain/whale-alerts]', err);
    res.json({ transactions: [] });
  }
});

router.get('/wallet/:address', async (req, res) => {
  try {
    const address = req.params.address;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.json({ error: 'Invalid address' });
    }

    const ETHERSCAN_KEY = await getApiKey('ETHERSCAN');
    const [balRes, txRes, tokenRes] = await Promise.allSettled([
      fetch(`https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
      fetch(`https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
      fetch(`https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${address}&page=1&offset=20&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
    ]);

    const ethPriceRes = await cgFetch('/simple/price', { ids: 'ethereum', vs_currencies: 'usd' });
    const ethPrice = ethPriceRes?.ethereum?.usd || 3500;

    const ethBalance = balRes.status === 'fulfilled' ? parseFloat(balRes.value?.result || '0') / 1e18 : 0;
    const transactions = txRes.status === 'fulfilled' ? (txRes.value?.result || []).map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: parseFloat(tx.value) / 1e18,
      timeStamp: tx.timeStamp,
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      isError: tx.isError,
      methodId: tx.methodId,
    })) : [];

    const tokenMap = new Map<string, any>();
    if (tokenRes.status === 'fulfilled') {
      (tokenRes.value?.result || []).forEach((t: any) => {
        if (!tokenMap.has(t.contractAddress)) {
          tokenMap.set(t.contractAddress, {
            name: t.tokenName,
            symbol: t.tokenSymbol,
            contractAddress: t.contractAddress,
            decimals: parseInt(t.tokenDecimal) || 18,
            balance: 0,
          });
        }
      });
    }

    res.json({
      address,
      ethBalance,
      ethPrice,
      tokens: Array.from(tokenMap.values()),
      transactions,
    });
  } catch (err) {
    console.error('[onchain/wallet]', err);
    res.json({ address: req.params.address, ethBalance: 0, ethPrice: 0, tokens: [], transactions: [] });
  }
});

router.get('/solana-wallet/:address', async (req, res) => {
  try {
    const address = req.params.address;
    if (!address || address.length < 32 || address.length > 44) {
      return res.json({ error: 'Invalid Solana address' });
    }

    const QN_KEY = await getApiKey('QUICKNODE');
    const rpcUrl = QN_KEY
      ? `https://winter-methodical-liquid.solana-mainnet.quiknode.pro/${QN_KEY}`
      : 'https://api.mainnet-beta.solana.com';

    const rpcCall = async (method: string, params: any[]) => {
      const rpcRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      return rpcRes.json();
    };

    const [balanceRes, tokenRes, txRes] = await Promise.allSettled([
      rpcCall('getBalance', [address]),
      rpcCall('getTokenAccountsByOwner', [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ]),
      rpcCall('getSignaturesForAddress', [address, { limit: 20 }]),
    ]);

    const solBalance = balanceRes.status === 'fulfilled'
      ? (balanceRes.value?.result?.value || 0) / 1e9
      : 0;

    const solPriceRes = await cgFetch('/simple/price', { ids: 'solana', vs_currencies: 'usd' });
    const solPrice = solPriceRes?.solana?.usd || 150;

    const tokens: any[] = [];
    if (tokenRes.status === 'fulfilled' && tokenRes.value?.result?.value) {
      tokenRes.value.result.value.forEach((account: any) => {
        const info = account?.account?.data?.parsed?.info;
        if (!info) return;
        const tokenAmount = info.tokenAmount;
        if (!tokenAmount || tokenAmount.uiAmount === 0) return;
        tokens.push({
          mint: info.mint || '',
          balance: tokenAmount.uiAmount || 0,
          decimals: tokenAmount.decimals || 0,
          symbol: '',
          name: '',
        });
      });
    }

    const signatures: any[] = [];
    if (txRes.status === 'fulfilled' && txRes.value?.result) {
      txRes.value.result.forEach((sig: any) => {
        signatures.push({
          signature: sig.signature || '',
          slot: sig.slot || 0,
          blockTime: sig.blockTime ? sig.blockTime * 1000 : 0,
          err: sig.err || null,
          memo: sig.memo || null,
        });
      });
    }

    res.json({
      address,
      solBalance,
      solPrice,
      balanceUsd: solBalance * solPrice,
      tokens,
      recentTransactions: signatures,
    });
  } catch (err) {
    console.error('[onchain/solana-wallet]', err);
    res.json({ address: req.params.address, solBalance: 0, solPrice: 0, balanceUsd: 0, tokens: [], recentTransactions: [] });
  }
});

export default router;
