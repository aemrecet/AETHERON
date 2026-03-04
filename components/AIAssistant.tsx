import React, { useState, useRef, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askGemini } from '../services/geminiService';
import { Stock } from '../types';

interface AIAssistantProps {
  marketContext: Stock[];
  isOpenExternal?: boolean;
  setIsOpenExternal?: (isOpen: boolean) => void;
  initialQuery?: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ marketContext, isOpenExternal, setIsOpenExternal, initialQuery }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: 'I am analyzing real-time market data with **advanced technical analysis**. Ask me to analyze any stock or crypto — I\'ll give you a clear **LONG/SHORT/NEUTRAL** signal with entry, take-profit, and stop-loss levels.\n\nTry: *"Analyze AAPL"* or *"Should I buy Bitcoin?"*' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOpen = isOpenExternal !== undefined ? isOpenExternal : internalIsOpen;
  const setIsOpen = setIsOpenExternal || setInternalIsOpen;

  useEffect(() => {
      if (initialQuery && isOpen) {
          setQuery(initialQuery);
      }
  }, [initialQuery, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || query;
    if (!textToSend.trim()) return;

    setQuery('');
    const userMsg: ChatMessage = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const contextStr = marketContext.map(s => `${s.symbol}: $${s.price.toFixed(2)} (${s.changePercent > 0 ? '+' : ''}${s.changePercent}%)`).join(', ');
    
    const apiMessages = [...messages, userMsg]
      .filter(m => m.role === 'user' || m.role === 'ai')
      .slice(-10)
      .map(m => ({
        role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
        content: m.text
      }));

    const response = await askGemini(textToSend, contextStr, apiMessages);
    
    setMessages(prev => [...prev, { role: 'ai', text: response }]);
    setLoading(false);
  };

  const handleReset = () => {
    setMessages([
      { role: 'ai', text: 'Chat reset. I\'m ready with fresh analysis. What would you like me to analyze?' }
    ]);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 group focus-ring rounded-full hidden md:flex ${isOpen ? '!hidden' : ''}`}
      >
        <div className="relative">
          <div className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105" style={{ background: '#f4f5f7', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 32px -4px rgba(0,0,0,0.12)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10b981] rounded-full" style={{ border: '2px solid #0d0e12' }}></div>
        </div>
      </button>

      <div className={`fixed z-50 transition-all duration-200 
        inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[520px] md:h-[680px] 
        md:rounded-lg flex flex-col overflow-hidden
        origin-bottom-right transform
        ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4 pointer-events-none'}`}
        style={{ background: '#0d0e12', boxShadow: isOpen ? '0 24px 80px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.06)' : 'none' }}
      >
        
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--color-border)', background: '#0d0e12' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#f4f5f7', border: '1px solid rgba(0,0,0,0.06)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
                <h3 className="font-semibold text-[12px]" style={{ color: 'var(--color-text-primary)' }}>{'\u00C6thron AI'}</h3>
                <div className="flex items-center gap-1">
                    <span className="relative flex h-1 w-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-1 w-1 bg-[#10b981]"></span>
                    </span>
                    <span className="text-[8px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>GPT-5.2</span>
                </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button 
              onClick={handleReset} 
              className="icon-btn w-7 h-7 rounded"
              title="Reset conversation"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button 
              onClick={() => setIsOpen(false)} 
              className="icon-btn w-7 h-7 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ background: '#111217' }}>
          <div className="max-w-[560px] mx-auto px-4 py-3 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'ai' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#f4f5f7', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5a9aee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                )}
                <div className={`flex-1 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                  {msg.role === 'ai' ? (
                    <div className="text-[13px] leading-[1.65]" style={{ color: 'var(--color-text-primary)' }}>
                      <div className="ai-markdown-content">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h3: ({children}) => <h3 className="text-[14px] font-semibold mt-4 mb-1.5 first:mt-0" style={{ color: 'var(--color-text-primary)' }}>{children}</h3>,
                            h4: ({children}) => <h4 className="text-[13px] font-semibold mt-3 mb-1" style={{ color: 'var(--color-text-primary)' }}>{children}</h4>,
                            strong: ({children}) => <strong className="font-semibold" style={{ color: '#0a0a23' }}>{children}</strong>,
                            em: ({children}) => <em className="not-italic" style={{ color: 'var(--color-accent)' }}>{children}</em>,
                            p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
                            ul: ({children}) => <ul className="mb-3 space-y-1.5 list-none">{children}</ul>,
                            ol: ({children}) => <ol className="mb-3 space-y-1.5 list-decimal list-inside">{children}</ol>,
                            li: ({children}) => <li className="text-[13px] leading-relaxed pl-0">{children}</li>,
                            table: ({children}) => (
                              <div className="my-3 overflow-x-auto rounded-md" style={{ border: '1px solid var(--color-border)' }}>
                                <table className="w-full text-[12px] border-collapse">{children}</table>
                              </div>
                            ),
                            thead: ({children}) => <thead style={{ background: '#f4f5f7' }}>{children}</thead>,
                            th: ({children}) => <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.06em] font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{children}</th>,
                            td: ({children}) => <td className="px-3 py-2 text-[12px] font-mono tabular-nums" style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)' }}>{children}</td>,
                            code: ({children, className}) => {
                              const isInline = !className;
                              return isInline 
                                ? <code className="px-1.5 py-0.5 rounded text-[12px] font-mono" style={{ background: 'rgba(76,139,245,0.1)', color: 'var(--color-accent)' }}>{children}</code>
                                : <code className={className}>{children}</code>;
                            },
                            hr: () => <hr className="my-4" style={{ borderColor: 'var(--color-border)' }} />,
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-block max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-[13px] leading-[1.5]" style={{ background: '#161616', color: 'var(--color-text-primary)' }}>
                      {msg.text}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
               <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#f4f5f7', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5a9aee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#555' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#555', animationDelay: '0.15s' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#555', animationDelay: '0.3s' }}></span>
                    </div>
                  </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="px-3 py-2.5" style={{ borderTop: '1px solid var(--color-border)', background: '#0d0e12' }}>
          <div className="flex items-center gap-2 rounded-full px-4" style={{ background: '#f4f5f7', border: '1px solid rgba(0,0,0,0.06)' }}>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Message \u00C6thron AI...`} 
              className="flex-1 bg-transparent border-none outline-none text-[12px] placeholder-[#555] py-2.5"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <button 
                onClick={() => handleSend()}
                disabled={!query.trim() || loading}
                className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition-all"
                style={{ background: query.trim() ? '#ffffff' : 'rgba(0,0,0,0.06)', color: query.trim() ? '#0d0e12' : '#555' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94l18.04-8.01a.75.75 0 000-1.36L3.478 2.405z" />
              </svg>
            </button>
          </div>
          <p className="text-[8px] text-center mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>{'\u00C6thron AI can make mistakes. Verify important market data.'}</p>
        </div>
      </div>
    </>
  );
};
