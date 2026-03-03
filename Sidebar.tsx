import React from 'react';
import { TabView } from '../types';

interface SidebarProps {
  activeTab: TabView;
  setActiveTab: (tab: TabView) => void;
}

const NavIcon: React.FC<{ id: TabView; active: boolean; size?: number }> = ({ id, active, size = 17 }) => {
  const color = active ? '#eef5ff' : '#8fa8cb';
  const sw = active ? '1.9' : '1.6';

  switch (id) {
    case TabView.ASK:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case TabView.MARKETS:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case TabView.PULSE:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case TabView.ONCHAIN:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case TabView.INSIDER:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case TabView.NEWS:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 14h-8" />
          <path d="M15 18h-5" />
          <path d="M10 6h8v4h-8V6Z" />
        </svg>
      );
    default:
      return null;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: TabView.ASK, label: 'Ask', shortLabel: 'Ask' },
    { id: TabView.MARKETS, label: 'Markets', shortLabel: 'Markets' },
    { id: TabView.PULSE, label: 'Pulse', shortLabel: 'Pulse' },
    { id: TabView.ONCHAIN, label: 'On-Chain', shortLabel: 'Chain' },
    { id: TabView.INSIDER, label: 'Insider', shortLabel: 'Insider' },
    { id: TabView.NEWS, label: 'Feeds', shortLabel: 'Feeds' },
  ];

  return (
    <>
      <header
        className="hidden md:flex items-center w-full fixed top-0 left-0 right-0 z-50 h-[68px] border-b"
        style={{
          background: 'rgba(7, 13, 24, 0.78)',
          borderColor: 'var(--color-border-subtle)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        }}
      >
        <div className="max-w-[1680px] w-full mx-auto px-5 lg:px-7 flex items-center gap-4">
          <button
            className="flex items-center cursor-pointer shrink-0 select-none gap-2.5"
            onClick={() => setActiveTab(TabView.ASK)}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(140deg, rgba(94, 161, 254, 0.36), rgba(38, 201, 212, 0.22))',
                border: '1px solid rgba(150, 196, 255, 0.52)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d6e9ff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold tracking-[0.2em] uppercase text-[#edf5ff]">AETHRON</span>
          </button>

          <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="nav-item h-10 px-3.5 rounded-xl text-[12px] font-semibold transition-all inline-flex items-center gap-1.5"
                  style={isActive
                    ? {
                        color: '#eef5ff',
                        border: '1px solid rgba(140, 183, 243, 0.44)',
                        background: 'linear-gradient(180deg, rgba(89, 151, 236, 0.24), rgba(16, 28, 46, 0.38))',
                        boxShadow: 'inset 0 0 0 1px rgba(143, 187, 245, 0.2)',
                      }
                    : {
                        color: '#8fa8cb',
                        border: '1px solid transparent',
                        background: 'transparent',
                      }}
                >
                  <span className="opacity-90 scale-[0.9]">
                    <NavIcon id={item.id} active={isActive} size={15} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(15, 27, 45, 0.7)', border: '1px solid var(--color-border-subtle)' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#20d39b] opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#20d39b]"></span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#a9c2e4] font-medium">Realtime</span>
          </div>

          <button
            className="h-10 px-4 rounded-xl text-[11px] font-semibold tracking-[0.03em] text-[#f7fbff] transition-all"
            style={{
              background: 'linear-gradient(140deg, #4f99f8 0%, #53b8f3 100%)',
              border: '1px solid rgba(164, 205, 255, 0.75)',
              boxShadow: '0 10px 22px rgba(36, 119, 221, 0.34)',
            }}
            onClick={() => setActiveTab(TabView.ASK)}
          >
            Upgrade
          </button>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        <div
          className="rounded-2xl p-1.5"
          style={{
            background: 'rgba(7, 13, 24, 0.92)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 14px 36px rgba(4, 10, 24, 0.36)',
            backdropFilter: 'blur(18px) saturate(145%)',
            WebkitBackdropFilter: 'blur(18px) saturate(145%)',
          }}
        >
          <div className="flex items-stretch justify-around">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl relative"
                  style={isActive ? { background: 'rgba(86, 149, 235, 0.2)' } : {}}
                >
                  <NavIcon id={item.id} active={isActive} />
                  <span className="text-[9px] font-semibold" style={{ color: isActive ? '#eef5ff' : '#8fa8cb' }}>{item.shortLabel}</span>
                  {isActive && (
                    <span className="absolute top-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#9ed0ff' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};
