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

      const spacing = 36;
      const cols = Math.ceil(canvas.width / spacing) + 1;
      const rows = Math.ceil(canvas.height / spacing) + 1;
      const cx = canvas.width * 0.5;
      const cy = canvas.height * 0.32;
      const maxDist = Math.sqrt(cx * cx + cy * cy);

      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const x = i * spacing;
          const y = j * spacing;
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const normDist = dist / maxDist;

          const wave = Math.sin(dist * 0.006 - time * 0.4) * 0.5 + 0.5;
          const fadeOut = Math.max(0, 1 - normDist * 1.3);
          const alpha = (0.008 + wave * 0.02) * fadeOut;
          const radius = (0.35 + wave * 0.55) * (0.7 + fadeOut * 0.35);

          if (alpha < 0.002) continue;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(61, 139, 253, ${alpha})`;
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

  html = html.replace(/^### (.+)$/gm, '<h3 class="text-[14px] font-semibold text-[#eaf2ff] mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-[15px] font-semibold text-[#eaf2ff] mt-6 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-[16px] font-semibold text-[#eaf2ff] mt-6 mb-3">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[#f0f6ff]">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md text-[12px] font-mono text-[#7db8ff] bg-[rgba(61,139,253,0.1)] border border-[rgba(61,139,253,0.15)]">$1</code>');

  html = html.replace(/^- (.+)$/gm, '<li class="text-[13px] text-[#b8cde6] leading-[1.72] pl-1">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="my-3 space-y-1 list-disc list-outside ml-5">${match}</ul>`);

  html = html.replace(/^\d+\. (.+)$/gm, '<li class="text-[13px] text-[#b8cde6] leading-[1.72] pl-1">$1</li>');

  html = html.replace(/\n\n/g, '</p><p class="text-[13px] text-[#b8cde6] leading-[1.72] mb-3">');
  html = html.replace(/\n/g, '<br/>');
  html = `<p class="text-[13px] text-[#b8cde6] leading-[1.72] mb-3">${html}</p>`;

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
      <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <MotionGrid />

        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(61,139,253,0.15), transparent 65%)' }} />
        <div className="absolute top-32 right-[10%] w-[300px] h-[300px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,201,144,0.08), transparent 65%)' }} />

        <section className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 py-6">
          <div className="max-w-[1080px] w-full mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
              <span className="text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-full font-medium" style={{ color: '#9cb4d4', background: 'rgba(61, 139, 253, 0.08)', border: '1px solid rgba(61, 139, 253, 0.15)' }}>
                AI Research Workspace
              </span>
              <span className="text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-full font-medium" style={{ color: '#9cb4d4', background: 'rgba(61, 139, 253, 0.05)', border: '1px solid rgba(61, 139, 253, 0.1)' }}>
                Multi-source + Live Markets
              </span>
            </div>

            <h1 className="text-center text-[32px] sm:text-[48px] font-bold tracking-[-0.03em] leading-[1.08] text-[#eaf2ff] max-w-[860px] mx-auto">
              Ask Anything. Get Decision-Ready
              <span className="block bg-gradient-to-r from-[#3d8bfd] to-[#22c990] bg-clip-text text-transparent">Market Intelligence.</span>
            </h1>

            <p className="text-center text-[14px] sm:text-[15px] text-[#7b95b8] leading-relaxed max-w-[680px] mx-auto mt-5 mb-10">
              Built for fast research loops: macro context, technical structure, flow data, and executable insights in a single prompt.
            </p>

            <div className="max-w-[800px] mx-auto rounded-xl p-1.5 mb-8" style={{ background: 'rgba(14, 24, 42, 0.6)', border: '1px solid rgba(120, 160, 220, 0.15)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
              <div className="relative">
                <input
                  ref={landingInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about markets, assets, setup quality, risk, and catalysts..."
                  className="w-full h-[56px] pl-5 pr-16 text-[14px] text-[#eaf2ff] rounded-lg placeholder:text-[#6b84a8]"
                  style={{ background: 'rgba(6, 10, 18, 0.9)', border: '1px solid rgba(120, 160, 220, 0.12)', outline: 'none' }}
                />

                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: input.trim() ? 'linear-gradient(135deg, #3d8bfd 0%, #2b7af0 100%)' : 'rgba(120, 160, 220, 0.08)',
                    border: input.trim() ? '1px solid rgba(100, 170, 255, 0.4)' : '1px solid rgba(120, 160, 220, 0.1)',
                    opacity: input.trim() ? 1 : 0.4,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : '#7b95b8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-w-[920px] mx-auto mb-8">
              {prompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSubmit(prompt.value)}
                  className="ask-chip text-left rounded-xl p-4 group"
                  style={{ background: 'rgba(14, 24, 42, 0.5)', border: '1px solid rgba(120, 160, 220, 0.1)' }}
                >
                  <p className="text-[12px] font-semibold text-[#c0d4ed] group-hover:text-[#eaf2ff] transition-colors">{prompt.title}</p>
                  <p className="text-[11px] text-[#6b84a8] leading-relaxed mt-1">{prompt.value}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-[920px] mx-auto">
              <div className="card p-5">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b84a8] font-semibold mb-3">Research Layer</p>
                <ul className="space-y-2.5 text-[12px] text-[#9cb4d4]">
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#3d8bfd] mt-1.5 shrink-0" />
                    Cross-market context from equities, crypto, and macro.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#3d8bfd] mt-1.5 shrink-0" />
                    Signal + narrative synthesis in one response.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#3d8bfd] mt-1.5 shrink-0" />
                    Live ticker context stitched into every answer.
                  </li>
                </ul>
              </div>
              <div className="card p-5">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b84a8] font-semibold mb-3">Execution Layer</p>
                <ul className="space-y-2.5 text-[12px] text-[#9cb4d4]">
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#22c990] mt-1.5 shrink-0" />
                    Actionable levels, invalidation zones, and risk framing.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#22c990] mt-1.5 shrink-0" />
                    Scenario-based recommendations instead of generic takes.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#22c990] mt-1.5 shrink-0" />
                    Instant follow-up prompts for rapid decision loops.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
      <MotionGrid />

      <div className="relative z-10 flex-1 max-w-[920px] w-full mx-auto px-4 sm:px-6 pt-6 pb-36">
        <div className="mb-5 rounded-lg px-3 py-1.5 inline-flex items-center gap-2" style={{ background: 'rgba(14, 24, 42, 0.5)', border: '1px solid rgba(120, 160, 220, 0.08)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c990]" />
          <span className="text-[10px] uppercase tracking-[0.06em] text-[#8ca3c4] font-medium">Conversation Mode</span>
        </div>

        <div className="space-y-5">
          {messages.map((message, idx) => (
            <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} slide-up`}>
              {message.role === 'assistant' && (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mr-3 mt-1"
                  style={{ background: 'rgba(61, 139, 253, 0.12)', border: '1px solid rgba(61, 139, 253, 0.2)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7db8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    background: 'rgba(61, 139, 253, 0.1)',
                    border: '1px solid rgba(61, 139, 253, 0.2)',
                  }}
                >
                  <p className="text-[14px] text-[#eaf2ff] leading-relaxed">{message.content}</p>
                </div>
              ) : (
                <div
                  className="max-w-[90%] min-w-0 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(10, 18, 32, 0.7)', border: '1px solid rgba(120, 160, 220, 0.1)' }}
                >
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start slide-up">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mr-3 mt-1"
                style={{ background: 'rgba(61, 139, 253, 0.12)', border: '1px solid rgba(61, 139, 253, 0.2)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7db8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex items-center gap-1.5 py-3 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3d8bfd] opacity-40 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#3d8bfd] opacity-40 animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#3d8bfd] opacity-40 animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 md:pb-6 pb-20">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(6, 10, 18, 0.97) 55%)' }} />
        <div className="relative max-w-[920px] mx-auto px-4 sm:px-6">
          <div className="relative p-1.5 rounded-xl" style={{ background: 'rgba(14, 24, 42, 0.6)', border: '1px solid rgba(120, 160, 220, 0.15)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
            <textarea
              ref={chatInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up..."
              rows={1}
              className="w-full pl-4 pr-14 py-3 text-[14px] text-[#eaf2ff] rounded-lg resize-none placeholder:text-[#6b84a8]"
              style={{ background: 'rgba(6, 10, 18, 0.9)', border: '1px solid rgba(120, 160, 220, 0.12)', outline: 'none' }}
            />

            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: input.trim() ? 'linear-gradient(135deg, #3d8bfd 0%, #2b7af0 100%)' : 'rgba(120, 160, 220, 0.08)',
                border: input.trim() ? '1px solid rgba(100, 170, 255, 0.4)' : '1px solid rgba(120, 160, 220, 0.1)',
                opacity: input.trim() ? 1 : 0.4,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : '#7b95b8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
