# DeFi Arbitrage Bot

A sophisticated DeFi arbitrage bot with AI-powered signal filtering, risk management, and real-time dashboard built on TypeScript.

## Features

- **Multi-DEX Arbitrage**: QuickSwap and SushiSwap on Polygon (UniV2)
- **AI Signal Filtering**: In-process logistic regression for trade scoring
- **Risk Management**: Daily loss caps, kill-switch, position sizing controls
- **Real-time Monitoring**: WebSocket-based price feeds and dashboard
- **Paper Trading**: Safe simulation mode with full trade tracking
- **Live Trading**: MetaMask wallet integration for actual execution

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development:**
   ```bash
   pnpm dev
   ```

## Architecture

