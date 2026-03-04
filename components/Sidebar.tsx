import React from 'react';
import { TabView } from '../types';

interface SidebarProps {
  activeTab: TabView;
  setActiveTab: (tab: TabView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: TabView.ASK, label: 'Ask' },
    { id: TabView.MARKETS, label: 'Markets' },
    { id: TabView.PULSE, label: 'Pulse' },
    { id: TabView.ONCHAIN, label: 'On-Chain' },
    { id: TabView.INSIDER, label: 'Insider' },
    { id: TabView.NEWS, label: 'Feeds' },
  ];

  return (
    <>
      <header className="hidden md:flex items-center w-full fixed top-0 left-0 right-0 z-50 h-[56px] bg-white border-b border-[#e2e5ea]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="w-full px-5 lg:px-8 flex items-center">
          <button
            className="flex items-center cursor-pointer shrink-0 select-none mr-10"
            onClick={() => setActiveTab(TabView.ASK)}
          >
            <img src="/46dd9de9-9ecd-4a05-8d29-d4c66ca0e6a5.png" alt="Aethron" className="w-[72px] h-[72px] mr-3 -my-4" />
            <span className="text-[18px] font-extrabold tracking-[0.15em] uppercase font-heading" style={{ color: '#0a0a23' }}>AETHRON</span>
          </button>

          <nav className="flex items-center gap-0">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id ||
                (item.id === TabView.MARKETS && activeTab === TabView.STOCK_DETAIL) ||
                (item.id === TabView.INSIDER && (activeTab === TabView.CONGRESS_DETAIL || activeTab === TabView.FUND_DETAIL));
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="h-[56px] px-5 text-[12px] font-semibold tracking-[0.04em] transition-colors relative"
                  style={{ color: isActive ? '#0a0a23' : '#8b91a0' }}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-5 right-5 h-[2px]" style={{ background: '#0a0a23' }} />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: '#0d9f6e' }} />
              <span className="text-[11px] tracking-[0.04em] font-medium" style={{ color: '#8b91a0' }}>Live</span>
            </div>

            <button
              className="h-8 px-4 text-[11px] font-semibold tracking-[0.04em] text-white rounded-md transition-colors"
              style={{ background: '#0a0a23' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1a1a3e'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0a0a23'}
              onClick={() => setActiveTab(TabView.ASK)}
            >
              Upgrade
            </button>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e2e5ea]" style={{ boxShadow: '0 -1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-stretch justify-around">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center flex-1 py-3 relative transition-colors"
              >
                <span className="text-[10px] font-semibold tracking-[0.04em]" style={{ color: isActive ? '#0a0a23' : '#8b91a0' }}>{item.label}</span>
                {isActive && <span className="absolute top-0 left-4 right-4 h-[2px]" style={{ background: '#0a0a23' }} />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
