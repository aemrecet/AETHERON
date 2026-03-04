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
      <header className="hidden md:flex items-center w-full fixed top-0 left-0 right-0 z-50 h-[48px] bg-black border-b border-[#1e1e1e]">
        <div className="w-full px-4 lg:px-6 flex items-center">
          <button
            className="flex items-center cursor-pointer shrink-0 select-none mr-8"
            onClick={() => setActiveTab(TabView.ASK)}
          >
            <span className="text-[14px] font-bold tracking-[0.2em] uppercase text-white font-mono">AETHRON</span>
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
                  className="h-[48px] px-4 text-[12px] font-semibold uppercase tracking-[0.06em] transition-colors relative"
                  style={{ color: isActive ? '#fff' : '#555' }}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-white" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00c076]" />
              <span className="text-[10px] uppercase tracking-[0.08em] text-[#555] font-mono font-medium">Live</span>
            </div>

            <button
              className="h-7 px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-white bg-[#2762bc] hover:bg-[#3578d8] transition-colors rounded-[3px]"
              onClick={() => setActiveTab(TabView.ASK)}
            >
              Upgrade
            </button>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[#1e1e1e]">
        <div className="flex items-stretch justify-around">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center flex-1 py-2.5 relative transition-colors"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: isActive ? '#fff' : '#555' }}>{item.label}</span>
                {isActive && <span className="absolute top-0 left-3 right-3 h-[2px] bg-white" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
