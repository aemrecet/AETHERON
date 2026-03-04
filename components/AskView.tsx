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

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatMarkdown = (text: string): string => {
  let html = escapeHtml(text);

  html = html.replace(/^### (.+)$/gm, '<h3 class="text-[13px] font-semibold text-white mt-4 mb-1.5">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-[14px] font-semibold text-white mt-5 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-[15px] font-semibold text-white mt-5 mb-2">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 text-[11px] font-mono text-[#5a9aee] bg-[#111] border border-[#1e1e1e] rounded-[2px]">$1</code>');

  html = html.replace(/^- (.+)$/gm, '<li class="text-[13px] text-[#999] leading-[1.7] pl-1">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="my-2 space-y-0.5 list-disc list-outside ml-5">${match}</ul>`);

  html = html.replace(/^\d+\. (.+)$/gm, '<li class="text-[13px] text-[#999] leading-[1.7] pl-1">$1</li>');

  html = html.replace(/\n\n/g, '</p><p class="text-[13px] text-[#999] leading-[1.7] mb-2">');
  html = html.replace(/\n/g, '<br/>');
  html = `<p class="text-[13px] text-[#999] leading-[1.7] mb-2">${html}</p>`;

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
      <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <section className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-8">
          <div className="max-w-[900px] w-full mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 text-[#555] border border-[#1e1e1e] font-mono rounded-[2px]">
                AI Research
              </span>
              <span className="text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 text-[#555] border border-[#1e1e1e] font-mono rounded-[2px]">
                Live Markets
              </span>
            </div>

            <h1 className="text-center text-[24px] sm:text-[36px] font-bold tracking-[0.04em] leading-[1.1] text-white max-w-[700px] mx-auto font-mono uppercase">
              Market Intelligence
            </h1>

            <p className="text-center text-[12px] text-[#555] leading-relaxed max-w-[520px] mx-auto mt-4 mb-8 font-mono">
              Macro context, technical structure, flow data, and executable insights.
            </p>

            <div className="max-w-[680px] mx-auto mb-8">
              <div className="relative">
                <input
                  ref={landingInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about markets, assets, risk, catalysts..."
                  className="w-full h-[48px] pl-4 pr-14 text-[13px] text-white bg-[#0d0d0d] border border-[#1e1e1e] rounded-[4px] placeholder:text-[#333] focus:border-[#2762bc] transition-colors"
                  style={{ outline: 'none' }}
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-colors rounded-[3px]"
                  style={{
                    background: input.trim() ? '#2762bc' : '#111',
                    opacity: input.trim() ? 1 : 0.3,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-[780px] mx-auto mb-10">
              {prompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSubmit(prompt.value)}
                  className="ask-chip text-left p-3 border border-[#1e1e1e] bg-[#0a0a0a] hover:bg-[#111] hover:border-[#2a2a2a] transition-colors rounded-[3px]"
                >
                  <p className="text-[9px] font-bold text-[#555] uppercase tracking-[0.1em] font-mono">{prompt.title}</p>
                  <p className="text-[11px] text-[#444] leading-relaxed mt-1">{prompt.value}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-[780px] mx-auto">
              <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-4 rounded-[3px]">
                <p className="text-[9px] uppercase tracking-[0.12em] text-[#555] font-mono font-semibold mb-3">Research Layer</p>
                <ul className="space-y-1.5 text-[12px] text-[#666]">
                  <li className="flex items-start gap-2"><span className="text-[#333] mt-0.5">-</span>Cross-market context from equities, crypto, and macro.</li>
                  <li className="flex items-start gap-2"><span className="text-[#333] mt-0.5">-</span>Signal + narrative synthesis in one response.</li>
                  <li className="flex items-start gap-2"><span className="text-[#333] mt-0.5">-</span>Live ticker context stitched into every answer.</li>
                </ul>
              </div>
              <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-4 rounded-[3px]">
                <p className="text-[9px] uppercase tracking-[0.12em] text-[#555] font-mono font-semibold mb-3">Execution Layer</p>
                <ul className="space-y-1.5 text-[12px] text-[#666]">
                  <li className="flex items-start gap-2"><span className="text-[#333] mt-0.5">-</span>Actionable levels, invalidation zones, and risk framing.</li>
                  <li className="flex items-start gap-2"><span className="text-[#333] mt-0.5">-</span>Scenario-based recommendations instead of generic takes.</li>
                  <li className="flex items-start gap-2"><span className="text-[#333] mt-0.5">-</span>Instant follow-up prompts for rapid decision loops.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 48px)' }}>
      <div className="flex-1 max-w-[800px] w-full mx-auto px-4 sm:px-6 pt-4 pb-32">
        <div className="mb-4 inline-flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00c076]" />
          <span className="text-[9px] uppercase tracking-[0.1em] text-[#555] font-mono font-semibold">Conversation</span>
        </div>

        <div className="space-y-4">
          {messages.map((message, idx) => (
            <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} slide-up`}>
              {message.role === 'assistant' && (
                <div className="w-6 h-6 flex items-center justify-center shrink-0 mr-2.5 mt-0.5 text-[10px] font-bold font-mono text-[#555] border border-[#1e1e1e] rounded-[3px] bg-[#0a0a0a]">
                  A
                </div>
              )}

              {message.role === 'user' ? (
                <div className="px-4 py-3 max-w-[78%] bg-[#111] border border-[#1e1e1e] rounded-[4px]">
                  <p className="text-[13px] text-white leading-relaxed">{message.content}</p>
                </div>
              ) : (
                <div className="max-w-[90%] min-w-0 px-4 py-3 bg-[#0a0a0a] border border-[#151515] rounded-[4px]">
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start slide-up">
              <div className="w-6 h-6 flex items-center justify-center shrink-0 mr-2.5 mt-0.5 text-[10px] font-bold font-mono text-[#555] border border-[#1e1e1e] rounded-[3px] bg-[#0a0a0a]">
                A
              </div>
              <div className="flex items-center gap-1.5 py-3 pl-1">
                <span className="w-1 h-1 rounded-full bg-[#333] animate-pulse" />
                <span className="w-1 h-1 rounded-full bg-[#333] animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-1 h-1 rounded-full bg-[#333] animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 md:pb-4 pb-16">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-transparent" />
        <div className="relative max-w-[800px] mx-auto px-4 sm:px-6">
          <div className="relative">
            <textarea
              ref={chatInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up..."
              rows={1}
              className="w-full pl-4 pr-14 py-3 text-[13px] text-white bg-[#0d0d0d] border border-[#1e1e1e] rounded-[4px] resize-none placeholder:text-[#333] focus:border-[#2762bc] transition-colors"
              style={{ outline: 'none' }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-colors rounded-[3px]"
              style={{
                background: input.trim() ? '#2762bc' : '#111',
                opacity: input.trim() ? 1 : 0.3,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
