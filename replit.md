# Aethron - AI Market Intelligence Platform

## Overview
Aethron is an AI-powered quantitative finance platform with a Venice.ai-inspired clean UI. The homepage is a centered chat interface (Ask page), while data views (Markets, Pulse, On-Chain, Insider, Feeds) are accessible via navigation. Real-time market data and advanced AI analysis using OpenAI's ChatGPT power the chat experience with live market context.

## UI Architecture
- **Homepage (Ask page)**: Venice.ai-style centered chat landing with "What do you want to know?" heading, pill-shaped input, prompt cards (3x2 grid), animated dot grid background. On submit: transitions to full chat with AI responses.
- **Data Pages**: Markets, Pulse, On-Chain, Insider, Feeds -- clean Venice-style with subtle cards, soft borders, spacious layout
- **No Intel/Dashboard page**: Removed. Ask is the homepage.
- **Animated Dot Grid Background**: Canvas-based animated dot pattern on Ask page (radial wave, blue-tinted, fades from center)
- **Navigation**: Glassmorphism top header (blur backdrop) with logo + nav tabs (Ask, Markets, Pulse, On-Chain, Insider, Feeds) + mobile bottom nav

## User Preferences
- Venice.ai style clean, minimal interface
- Dark professional UI with ultra-clean design
- NO emojis anywhere in UI or server code
- Clean spacious layouts, subtle borders, rounded corners (12px cards, 10px inputs)

## Design System (Venice-Clean)

**Colors:**
- Background: `#0d0e12`
- Surface: `rgba(255,255,255,0.02)` (very subtle)
- Borders: `rgba(255,255,255,0.04)` (barely visible)
- Text primary: `#e4e8ee`, secondary: `#868c98`, tertiary: `#4a4f5c`
- Accent: `#4c8bf5`
- Positive: `#10b981`, Negative: `#ef4444`, Warning: `#f59e0b`

**Card/Container Style:**
- `.card` -- `rgba(255,255,255,0.02)` bg, `rgba(255,255,255,0.04)` border, 12px radius
- `.card-interactive` -- hover: `rgba(255,255,255,0.04)` bg
- All containers blend into background, no harsh edges

**Table Style:**
- `.table-header` -- `rgba(255,255,255,0.015)` bg
- `.table-row` -- hover: `rgba(255,255,255,0.02)`, very subtle
- `.table-row-stripe` -- even rows: `rgba(255,255,255,0.01)`

**Navigation:**
- 44px glassmorphism header with backdrop blur
- Nav items: 12px font-medium, inactive `#4a4f5c`, active `#e4e8ee` + 1.5px blue bar
- `.nav-item` CSS class for hover transitions

**Interactive Elements:**
- `.tab-btn` -- 12px, rounded 8px, hover bg `rgba(255,255,255,0.02)`
- `.tab-btn-active` -- filled bg `rgba(255,255,255,0.04)`, no underline
- `.input-field` -- `rgba(255,255,255,0.03)` bg, 10px radius
- `.ask-chip` -- subtle hover to `rgba(255,255,255,0.06)`
- `.btn-primary` -- 10px radius, accent blue

**Typography:** Inter for UI, IBM Plex Mono for data/numbers.

**Ask Page:**
- Centered 38px font-light heading, no icon
- Pill-shaped input (rounded-full, 52px height)
- 3x2 prompt grid: Summarize/Analyze/Compare/Predict/Evaluate/Explore
- Chat view: 720px max-width, rounded-3xl user pills, slide-up animations

## Technical Architecture
- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Express.js for API routing, data aggregation, and caching
- **AI:** OpenAI ChatGPT via Replit AI Integrations with technical indicators auto-injection
- **Data Caching:** Server-side (BIST:30min, NASDAQ:5min, Crypto:2min, News:60min)

## Features
- **Ask (Homepage):** Venice.ai-style AI chat with market context
- **Markets:** NASDAQ, BIST, Crypto, Meme Coins with sortable tables
- **Feeds:** AI-curated news, sentiment analysis, Economic Calendar
- **On-Chain:** Wallet lookup, gas tracker, Whale Alerts
- **Insider:** Corporate insider trades, congressional trading, fund holdings
- **Pulse:** Global crypto stats, exchanges, BTC treasuries

## External Dependencies
- **AI:** OpenAI ChatGPT (via Replit AI Integrations)
- **Market Data:** Yahoo Finance, CoinGecko, Finnhub, DexScreener, CryptoCompare, Etherscan V2, alternative.me, Whale Alert
- **Logo Services:** Google Favicon, Parqet, icon.horse
