import React, { useState, useRef, useEffect } from 'react';
import { Stock } from '../types';
import { askGemini } from '../services/geminiService';
import { AnimatedBackground } from './AnimatedBackground';

interface AskViewProps {
  stocks: Stock[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatMarkdown = (text: string): string => {
  let html = escapeHtml(text);

  html = html.replace(/^### (.+)$/gm, '<h3 class="text-[14px] font-semibold mt-4 mb-1.5" style="color:#0a0a23">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-[15px] font-semibold mt-5 mb-2" style="color:#0a0a23">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-[16px] font-semibold mt-5 mb-2" style="color:#0a0a23">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold" style="color:#0a0a23">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 text-[12px] font-mono rounded" style="color:#1a6bdb;background:#f0f4f8;border:1px solid #e2e5ea">$1</code>');

  html = html.replace(/^- (.+)$/gm, '<li class="text-[13px] leading-[1.7] pl-1" style="color:#4a4f5c">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="my-2 space-y-0.5 list-disc list-outside ml-5">${match}</ul>`);

  html = html.replace(/^\d+\. (.+)$/gm, '<li class="text-[13px] leading-[1.7] pl-1" style="color:#4a4f5c">$1</li>');

  html = html.replace(/\n\n/g, '</p><p class="text-[13px] leading-[1.7] mb-2" style="color:#4a4f5c">');
  html = html.replace(/\n/g, '<br/>');
  html = `<p class="text-[13px] leading-[1.7] mb-2" style="color:#4a4f5c">${html}</p>`;

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
    { title: 'MACRO SCENARIO', value: 'Map rates and risk sentiment for this week' },
    { title: 'MOMENTUM SCAN', value: 'Find strongest sector and crypto rotation' },
    { title: 'TRADE PLAN', value: 'Build a swing plan for NASDAQ and BTC' },
    { title: 'RISK AUDIT', value: 'What invalidates this bullish thesis?' },
    { title: 'FLOW WATCH', value: 'Summarize whales and unusual options flow' },
    { title: 'RELATIVE STRENGTH', value: 'Compare ETH, SOL, AVAX leadership' },
  ];

  if (!isChat) {
    return (
      <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 56px)', background: '#f8f9fb', overflow: 'hidden' }}>
        <AnimatedBackground />
        <section className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 py-10">
          <div className="max-w-[900px] w-full mx-auto">
            <div className="flex items-center justify-center gap-3 mb-8">
              <span className="text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-md font-medium" style={{ color: '#8b91a0', background: '#f4f5f7', border: '1px solid #e2e5ea' }}>
                AI Research
              </span>
              <span className="text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-md font-medium" style={{ color: '#8b91a0', background: '#f4f5f7', border: '1px solid #e2e5ea' }}>
                Live Markets
              </span>
            </div>

            <h1 className="text-center font-heading font-bold leading-[1.1] max-w-[700px] mx-auto" style={{ fontSize: 'clamp(28px, 5vw, 42px)', color: '#0a0a23' }}>
              Market Intelligence
            </h1>

            <p className="text-center text-[14px] leading-relaxed max-w-[520px] mx-auto mt-5 mb-10" style={{ color: '#8b91a0' }}>
              Macro context, technical structure, flow data, and executable insights.
            </p>

            <div className="max-w-[680px] mx-auto mb-10">
              <div className="relative">
                <input
                  ref={landingInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about markets, assets, risk, catalysts..."
                  className="w-full h-[52px] pl-5 pr-14 text-[14px] bg-white rounded-xl transition-all"
                  style={{ border: '1px solid #e2e5ea', color: '#0a0a23', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1a6bdb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,107,219,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e5ea'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim()}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center transition-colors rounded-lg"
                  style={{
                    background: input.trim() ? '#0a0a23' : '#f4f5f7',
                    opacity: input.trim() ? 1 : 0.5,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : '#8b91a0'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-[780px] mx-auto mb-12">
              {prompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSubmit(prompt.value)}
                  className="ask-chip text-left p-4 rounded-xl transition-all"
                  style={{ border: '1px solid #e2e5ea', background: '#fff' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#8b91a0' }}>{prompt.title}</p>
                  <p className="text-[12px] leading-relaxed mt-1.5" style={{ color: '#4a4f5c' }}>{prompt.value}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-[780px] mx-auto">
              <div className="p-5 rounded-xl" style={{ background: '#f8f9fa', border: '1px solid #e2e5ea' }}>
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold mb-3" style={{ color: '#8b91a0' }}>Research Layer</p>
                <ul className="space-y-2 text-[13px]" style={{ color: '#4a4f5c' }}>
                  <li className="flex items-start gap-2"><span style={{ color: '#c8cdd5' }}>--</span>Cross-market context from equities, crypto, and macro.</li>
                  <li className="flex items-start gap-2"><span style={{ color: '#c8cdd5' }}>--</span>Signal + narrative synthesis in one response.</li>
                  <li className="flex items-start gap-2"><span style={{ color: '#c8cdd5' }}>--</span>Live ticker context stitched into every answer.</li>
                </ul>
              </div>
              <div className="p-5 rounded-xl" style={{ background: '#f8f9fa', border: '1px solid #e2e5ea' }}>
                <p className="text-[10px] uppercase tracking-[0.08em] font-semibold mb-3" style={{ color: '#8b91a0' }}>Execution Layer</p>
                <ul className="space-y-2 text-[13px]" style={{ color: '#4a4f5c' }}>
                  <li className="flex items-start gap-2"><span style={{ color: '#c8cdd5' }}>--</span>Actionable levels, invalidation zones, and risk framing.</li>
                  <li className="flex items-start gap-2"><span style={{ color: '#c8cdd5' }}>--</span>Scenario-based recommendations instead of generic takes.</li>
                  <li className="flex items-start gap-2"><span style={{ color: '#c8cdd5' }}>--</span>Instant follow-up prompts for rapid decision loops.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 56px)', background: '#fff' }}>
      <div className="flex-1 max-w-[800px] w-full mx-auto px-4 sm:px-6 pt-6 pb-32">
        <div className="mb-5 inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: '#0d9f6e' }} />
          <span className="text-[11px] uppercase tracking-[0.06em] font-medium" style={{ color: '#8b91a0' }}>Conversation</span>
        </div>

        <div className="space-y-5">
          {messages.map((message, idx) => (
            <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} slide-up`}>
              {message.role === 'assistant' && (
                <div className="w-7 h-7 flex items-center justify-center shrink-0 mr-3 mt-0.5 text-[11px] font-bold font-heading rounded-lg" style={{ color: '#fff', background: '#0a0a23' }}>
                  A
                </div>
              )}

              {message.role === 'user' ? (
                <div className="px-4 py-3 max-w-[78%] rounded-xl" style={{ background: '#f4f5f7', border: '1px solid #e2e5ea' }}>
                  <p className="text-[13px] leading-relaxed" style={{ color: '#0a0a23' }}>{message.content}</p>
                </div>
              ) : (
                <div className="max-w-[90%] min-w-0 px-4 py-3 rounded-xl" style={{ background: '#fafbfc', border: '1px solid #eef0f4' }}>
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start slide-up">
              <div className="w-7 h-7 flex items-center justify-center shrink-0 mr-3 mt-0.5 text-[11px] font-bold font-heading rounded-lg" style={{ color: '#fff', background: '#0a0a23' }}>
                A
              </div>
              <div className="flex items-center gap-2 py-3 pl-1">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#c8cdd5' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#c8cdd5', animationDelay: '200ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#c8cdd5', animationDelay: '400ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 md:pb-5 pb-16">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #fff, #fff 60%, transparent)' }} />
        <div className="relative max-w-[800px] mx-auto px-4 sm:px-6">
          <div className="relative">
            <textarea
              ref={chatInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up..."
              rows={1}
              className="w-full pl-4 pr-14 py-3.5 text-[14px] bg-white rounded-xl resize-none transition-all"
              style={{ border: '1px solid #e2e5ea', color: '#0a0a23', outline: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1a6bdb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,107,219,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e5ea'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || loading}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center transition-colors rounded-lg"
              style={{
                background: input.trim() ? '#0a0a23' : '#f4f5f7',
                opacity: input.trim() ? 1 : 0.5,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : '#8b91a0'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
