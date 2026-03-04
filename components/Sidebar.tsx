import React from 'react';
import { TabView } from '../types';

interface SidebarProps {
  activeTab: TabView;
  setActiveTab: (tab: TabView) => void;
}

const NavIcon: React.FC<{ id: TabView; active: boolean; size?: number }> = ({ id, active, size = 17 }) => {
  const color = active ? '#eef5ff' : '#7b95b8';
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
        className="hidden md:flex items-center w-full fixed top-0 left-0 right-0 z-50 h-[60px]"
        style={{
          background: 'rgba(6, 10, 18, 0.82)',
          borderBottom: '1px solid rgba(120, 160, 220, 0.08)',
          backdropFilter: 'blur(24px) saturate(130%)',
          WebkitBackdropFilter: 'blur(24px) saturate(130%)',
        }}
      >
        <div className="max-w-[1680px] w-full mx-auto px-5 lg:px-7 flex items-center gap-5">
          <button
            className="flex items-center cursor-pointer shrink-0 select-none gap-2.5 group"
            onClick={() => setActiveTab(TabView.ASK)}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, rgba(61, 139, 253, 0.2), rgba(34, 201, 144, 0.12))',
                border: '1px solid rgba(61, 139, 253, 0.3)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0e4ff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-[13px] font-bold tracking-[0.18em] uppercase text-[#e8f0ff]">AETHRON</span>
          </button>

          <div className="w-px h-6 bg-[rgba(120,160,220,0.1)]" />

          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="nav-item h-9 px-3.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-2 relative"
                  style={{
                    color: isActive ? '#eef5ff' : '#7b95b8',
                    background: isActive ? 'rgba(61, 139, 253, 0.1)' : 'transparent',
                    border: isActive ? '1px solid rgba(61, 139, 253, 0.2)' : '1px solid transparent',
                    transition: 'all 180ms ease',
                  }}
                >
                  <span className="opacity-80 scale-[0.88]">
                    <NavIcon id={item.id} active={isActive} size={15} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(14, 24, 42, 0.5)', border: '1px solid rgba(120, 160, 220, 0.08)' }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c990] opacity-50"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c990]"></span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.06em] text-[#8ca3c4] font-medium">Live</span>
          </div>

          <button
            className="h-9 px-4 rounded-lg text-[11px] font-semibold tracking-[0.02em] text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #3d8bfd 0%, #2b7af0 100%)',
              border: '1px solid rgba(100, 170, 255, 0.35)',
              boxShadow: '0 4px 12px rgba(42, 110, 224, 0.2)',
            }}
            onClick={() => setActiveTab(TabView.ASK)}
          >
            Upgrade
          </button>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),6px)]">
        <div
          className="rounded-2xl p-1"
          style={{
            background: 'rgba(6, 10, 18, 0.92)',
            border: '1px solid rgba(120, 160, 220, 0.08)',
            boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(24px) saturate(130%)',
            WebkitBackdropFilter: 'blur(24px) saturate(130%)',
          }}
        >
          <div className="flex items-stretch justify-around">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl relative transition-all"
                  style={isActive ? { background: 'rgba(61, 139, 253, 0.1)' } : {}}
                >
                  <NavIcon id={item.id} active={isActive} />
                  <span className="text-[9px] font-semibold" style={{ color: isActive ? '#eef5ff' : '#7b95b8' }}>{item.shortLabel}</span>
                  {isActive && (
                    <span className="absolute top-1 w-1 h-1 rounded-full bg-[#3d8bfd]" />
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
