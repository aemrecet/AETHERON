import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import yahooFinance from 'yahoo-finance2';
import marketsRouter from './routes/markets.js';
import pulseRouter from './routes/pulse.js';
import onchainRouter from './routes/onchain.js';
import insiderRouter from './routes/insider.js';
import newsRouter from './routes/news.js';
import { getApiKey } from './apiKeys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? 5000 : 3001;

app.use(cors());
app.use(express.json());

app.use('/api', marketsRouter);
app.use('/api/pulse', pulseRouter);
app.use('/api/onchain', onchainRouter);
app.use('/api/insider', insiderRouter);
app.use('/api', newsRouter);

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, marketContext } = req.body;
    const openaiKey = await getApiKey('OPENAI');

    if (!openaiKey) {
      const geminiKey = await getApiKey('GEMINI');
      if (!geminiKey) {
        return res.json({ reply: 'AI service is not configured.' });
      }
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const lastMessage = messages?.[messages.length - 1]?.content || '';
      const systemPrompt = `You are Aethron, an elite financial markets AI analyst. You have access to live market data. Be concise, data-driven, and actionable. Use bullet points. Always include specific price levels and percentages when relevant.\n\nCurrent market context: ${marketContext || 'No live data available.'}`;
      const contents = [
        { role: 'user' as const, parts: [{ text: systemPrompt }] },
        { role: 'model' as const, parts: [{ text: 'Understood. I am Aethron, ready to provide market intelligence.' }] },
      ];
      if (messages && messages.length > 1) {
        for (const msg of messages.slice(0, -1)) {
          contents.push({
            role: msg.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: msg.content }],
          });
        }
      }
      contents.push({ role: 'user' as const, parts: [{ text: lastMessage }] });
      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents });
      return res.json({ reply: response.text || 'No response generated.' });
    }

    const lastMessage = messages?.[messages.length - 1]?.content || '';

    let techContext = '';
    const symbolMatch = lastMessage.match(/\b([A-Z]{1,5})\b/);
    if (symbolMatch) {
      try {
        const quote = await yahooFinance.quote(symbolMatch[1]);
        if (quote && quote.regularMarketPrice) {
          techContext = `\n\nLive data for ${symbolMatch[1]}: Price: $${quote.regularMarketPrice}, Change: ${quote.regularMarketChangePercent?.toFixed(2)}%, Day High: $${quote.regularMarketDayHigh}, Day Low: $${quote.regularMarketDayLow}, Volume: ${quote.regularMarketVolume}, Market Cap: $${quote.marketCap}, 52W High: ${(quote as any).fiftyTwoWeekHigh || 'N/A'}, 52W Low: ${(quote as any).fiftyTwoWeekLow || 'N/A'}`;
        }
      } catch {}
    }

    const systemPrompt = `You are Aethron, an elite financial markets AI analyst with deep expertise in technical analysis, fundamental analysis, and market intelligence. You have access to live market data. Be concise, data-driven, and actionable. Use bullet points and markdown formatting. Always include specific price levels and percentages when relevant. Provide buy/sell zones, support/resistance levels, and risk assessments when analyzing assets.\n\nCurrent market context: ${marketContext || 'No live data available.'}${techContext}`;

    const openaiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...(messages || []).map((m: any) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
    ];

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: openaiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      max_tokens: 2000,
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content || 'No response generated.';
    res.json({ reply });
  } catch (err) {
    console.error('[ai/chat]', err);
    res.json({ reply: 'AI service encountered an error. Please try again.' });
  }
});

if (isProd) {
  const distPath = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Running on port ${PORT}`);
});
