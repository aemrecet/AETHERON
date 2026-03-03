import React, { useState, useRef, useEffect } from 'react';
import { Stock } from '../types';
import { askGemini } from '../services/geminiService';

interface AskViewProps {
  stocks: Stock[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MotionGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const spacing = 30;
      const cols = Math.ceil(canvas.width / spacing) + 1;
      const rows = Math.ceil(canvas.height / spacing) + 1;
      const cx = canvas.width * 0.5;
      const cy = canvas.height * 0.34;
      const maxDist = Math.sqrt(cx * cx + cy * cy);

      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const x = i * spacing;
          const y = j * spacing;
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const normDist = dist / maxDist;

          const wave = Math.sin(dist * 0.007 - time * 0.52) * 0.5 + 0.5;
          const fadeOut = Math.max(0, 1 - normDist * 1.22);
          const alpha = (0.012 + wave * 0.03) * fadeOut;
          const radius = (0.38 + wave * 0.62) * (0.7 + fadeOut * 0.36);

          if (alpha < 0.003) continue;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(102, 173, 255, ${alpha})`;
          ctx.fill();
        }
      }

      time += 0.016;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatMarkdown = (text: string): string => {
  let html = escapeHtml(text);

  html = html.replace(/^### (.+)$/gm, '<h3 class="text-[14px] font-semibold text-[#edf5ff] mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-[15px] font-semibold text-[#edf5ff] mt-6 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-[16px] font-semibold text-[#edf5ff] mt-6 mb-3">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[#f7fbff]">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md text-[12px] font-mono text-[#9fd0ff] bg-[rgba(104,161,236,0.16)] border border-[rgba(145,192,250,0.2)]">$1</code>');

  html = html.replace(/^- (.+)$/gm, '<li class="text-[13px] text-[#c7d7ee] leading-[1.72] pl-1">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="my-3 space-y-1 list-disc list-outside ml-5">${match}</ul>`);

  html = html.replace(/^\d+\. (.+)$/gm, '<li class="text-[13px] text-[#c7d7ee] leading-[1.72] pl-1">$1</li>');

  html = html.replace(/\n\n/g, '</p><p class="text-[13px] text-[#c7d7ee] leading-[1.72] mb-3">');
  html = html.replace(/\n/g, '<br/>');
  html = `<p class="text-[13px] text-[#c7d7ee] leading-[1.72] mb-3">${html}</p>`;

  return html;
};

export const AskView: React.FC<AskViewProps> = ({ stocks }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isChat, setIsChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const landingInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isChat) {
        chatInputRef.current?.focus();
      } else {
        landingInputRef.current?.focus();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isChat]);

  const buildContext = () => {
    const top = stocks
      .slice(0, 30)
      .map((stock) => `${stock.symbol}: $${stock.price.toFixed(2)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)`)
      .join(', ');

    return `Live market data: ${top}`;
  };

  const handleSubmit = async (text?: string) => {
    const query = text || input.trim();
    if (!query || loading) return;

    setIsChat(true);
    setInput('');

    const userMessage: Message = { role: 'user', content: query };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const history = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const reply = await askGemini(query, buildContext(), history);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const prompts = [
    { title: 'Macro Scenario', value: 'Map rates and risk sentiment for this week' },
    { title: 'Momentum Scan', value: 'Find strongest sector and crypto rotation' },
    { title: 'Trade Plan', value: 'Build a swing plan for NASDAQ and BTC' },
    { title: 'Risk Audit', value: 'What invalidates this bullish thesis?' },
    { title: 'Flow Watch', value: 'Summarize whales and unusual options flow' },
    { title: 'Relative Strength', value: 'Compare ETH, SOL, AVAX leadership' },
  ];

  if (!isChat) {
    return (
      <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 68px)' }}>
        <MotionGrid />

        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(66,142,247,0.26), transparent 62%)' }} />
        <div className="absolute top-24 right-[8%] w-[300px] h-[300px] rounded-full blur-[110px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(31,182,191,0.18), transparent 65%)' }} />

        <section className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 py-6">
          <div className="max-w-[1080px] w-full mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <span className="text-[10px] uppercase tracking-[0.12em] px-3 py-1 rounded-full" style={{ color: '#bed5f4', background: 'rgba(66, 114, 188, 0.22)', border: '1px solid rgba(139, 179, 232, 0.34)' }}>
                AI Research Workspace
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] px-3 py-1 rounded-full" style={{ color: '#bed5f4', background: 'rgba(66, 114, 188, 0.14)', border: '1px solid rgba(139, 179, 232, 0.26)' }}>
                Multi-source + Live Markets
              </span>
            </div>

            <h1 className="text-center text-[34px] sm:text-[52px] font-semibold tracking-[-0.03em] leading-[1.04] text-[#f6fbff] max-w-[900px] mx-auto">
              Ask Anything. Get Decision-Ready Market Intelligence.
            </h1>

            <p className="text-center text-[14px] sm:text-[16px] text-[#a6bee0] leading-relaxed max-w-[760px] mx-auto mt-4 mb-10">
              Built for fast research loops: macro context, technical structure, flow data, and executable insights in a single prompt.
            </p>

            <div className="max-w-[840px] mx-auto rounded-2xl p-2 mb-8" style={{ background: 'linear-gradient(150deg, rgba(92, 150, 230, 0.24), rgba(11, 20, 34, 0.52) 45%)', border: '1px solid rgba(136, 178, 233, 0.35)', boxShadow: '0 20px 40px rgba(5, 12, 24, 0.38)' }}>
              <div className="relative">
                <input
                  ref={landingInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about markets, assets, setup quality, risk, and catalysts..."
                  className="w-full h-[60px] pl-5 pr-16 text-[15px] text-[#f3f9ff] rounded-xl placeholder:text-[#7f98bc]"
                  style={{ background: 'rgba(7, 13, 24, 0.9)', border: '1px solid rgba(122, 164, 221, 0.26)', outline: 'none' }}
                />

                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: input.trim() ? 'linear-gradient(140deg, #4f99f8 0%, #53b8f3 100%)' : 'rgba(120, 142, 176, 0.2)',
                    border: input.trim() ? '1px solid rgba(164, 205, 255, 0.76)' : '1px solid rgba(130, 152, 184, 0.32)',
                    opacity: input.trim() ? 1 : 0.45,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#f7fbff' : '#90a8c9'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-w-[980px] mx-auto mb-7">
              {prompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSubmit(prompt.value)}
                  className="ask-chip text-left rounded-xl p-3.5"
                  style={{ background: 'linear-gradient(180deg, rgba(17, 29, 48, 0.84), rgba(12, 21, 35, 0.9))', border: '1px solid rgba(118, 155, 207, 0.25)' }}
                >
                  <p className="text-[12px] font-semibold text-[#d5e5fb]">{prompt.title}</p>
                  <p className="text-[11px] text-[#8ea8cb] leading-relaxed mt-1">{prompt.value}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-[980px] mx-auto">
              <div className="card p-4">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[#9cb8dd] font-semibold">Research Layer</p>
                <ul className="mt-3 space-y-2 text-[12px] text-[#bed0eb]">
                  <li>Cross-market context from equities, crypto, and macro.</li>
                  <li>Signal + narrative synthesis in one response.</li>
                  <li>Live ticker context stitched into every answer.</li>
                </ul>
              </div>
              <div className="card p-4">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[#9cb8dd] font-semibold">Execution Layer</p>
                <ul className="mt-3 space-y-2 text-[12px] text-[#bed0eb]">
                  <li>Actionable levels, invalidation zones, and risk framing.</li>
                  <li>Scenario-based recommendations instead of generic takes.</li>
                  <li>Instant follow-up prompts for rapid decision loops.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 68px)' }}>
      <MotionGrid />

      <div className="relative z-10 flex-1 max-w-[980px] w-full mx-auto px-4 sm:px-6 pt-6 pb-36">
        <div className="mb-4 rounded-xl px-3 py-2 inline-flex items-center gap-2" style={{ background: 'rgba(16, 28, 48, 0.65)', border: '1px solid var(--color-border-subtle)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#20d39b]" />
          <span className="text-[10px] uppercase tracking-[0.08em] text-[#abc4e5]">Conversation Mode</span>
        </div>

        <div className="space-y-5">
          {messages.map((message, idx) => (
            <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} slide-up`}>
              {message.role === 'assistant' && (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mr-3 mt-1"
                  style={{ background: 'linear-gradient(135deg, rgba(88, 148, 232, 0.28), rgba(26, 158, 170, 0.2))', border: '1px solid rgba(140, 185, 245, 0.4)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d8eaff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
              )}

              {message.role === 'user' ? (
                <div
                  className="px-5 py-3.5 rounded-2xl max-w-[78%]"
                  style={{
                    background: 'linear-gradient(138deg, rgba(81, 141, 224, 0.32), rgba(14, 24, 40, 0.9))',
                    border: '1px solid rgba(124, 168, 232, 0.35)',
                    boxShadow: '0 8px 20px rgba(7, 15, 30, 0.3)',
                  }}
                >
                  <p className="text-[14px] text-[#f4f9ff] leading-relaxed">{message.content}</p>
                </div>
              ) : (
                <div
                  className="max-w-[90%] min-w-0 px-4 py-3 rounded-2xl"
                  style={{ background: 'linear-gradient(180deg, rgba(16, 25, 40, 0.88), rgba(10, 16, 26, 0.94))', border: '1px solid rgba(121, 157, 207, 0.22)' }}
                >
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start slide-up">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mr-3 mt-1"
                style={{ background: 'linear-gradient(135deg, rgba(88, 148, 232, 0.28), rgba(26, 158, 170, 0.2))', border: '1px solid rgba(140, 185, 245, 0.4)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d8eaff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex items-center gap-1.5 py-3 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7db4ff] opacity-50 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#7db4ff] opacity-50 animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#7db4ff] opacity-50 animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 md:pb-6 pb-20">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(5, 9, 16, 0.96) 58%)' }} />
        <div className="relative max-w-[980px] mx-auto px-4 sm:px-6">
          <div className="relative p-2 rounded-2xl" style={{ background: 'linear-gradient(150deg, rgba(92, 150, 230, 0.24), rgba(11, 20, 34, 0.52) 45%)', border: '1px solid rgba(136, 178, 233, 0.35)', boxShadow: '0 18px 38px rgba(4, 10, 24, 0.38)' }}>
            <textarea
              ref={chatInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up and refine the output..."
              rows={1}
              className="w-full pl-4 pr-14 py-3.5 text-[15px] text-[#f4f9ff] rounded-xl resize-none placeholder:text-[#7f98bc]"
              style={{ background: 'rgba(7, 13, 24, 0.9)', border: '1px solid rgba(122, 164, 221, 0.26)', outline: 'none' }}
            />

            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: input.trim() ? 'linear-gradient(140deg, #4f99f8 0%, #53b8f3 100%)' : 'rgba(120, 142, 176, 0.22)',
                border: input.trim() ? '1px solid rgba(164, 205, 255, 0.8)' : '1px solid rgba(130, 152, 184, 0.32)',
                opacity: input.trim() ? 1 : 0.45,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#f7fbff' : '#90a8c9'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
