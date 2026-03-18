"use client"

import React, { useState } from 'react'
import { 
  FlaskConical, 
  Target, 
  ShieldAlert, 
  BarChart4,
  History,
  AlertTriangle,
  AlertCircle,
  X,
  List,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import TradeChartPopup from './TradeChartPopup'

interface BacktestResults {
  summary: {
    initial_capital: number
    final_equity: number
    total_trades: number
    win_rate: number
    roi_pct: number
  }
  trades: any[]
  equity_curve: any[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Log Popup – appears when hovering a ticker row; closed only via X
// ─────────────────────────────────────────────────────────────────────────────
function TradeLogPopup({
  ticker,
  trades,
  onClose,
}: {
  ticker: string
  trades: any[]
  onClose: () => void
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto bg-white border border-indigo-200 rounded-3xl shadow-2xl shadow-indigo-100 w-[720px] max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <List className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-black text-zinc-900 text-sm">Trade Log — {ticker}</h3>
              <p className="text-[10px] text-zinc-400">{trades.length} trades in simulation period</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4 custom-scrollbar">
          {trades.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-zinc-300">
              <AlertCircle className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium">No trades found for {ticker}</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-[10px] font-black text-zinc-400 uppercase">
                  <th className="px-3 py-2">Entry</th>
                  <th className="px-3 py-2">Exit</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">SL / TP</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t: any, i: number) => (
                  <React.Fragment key={i}>
                    <tr 
                      className="bg-zinc-50 hover:bg-indigo-50 transition-colors rounded-xl group cursor-pointer"
                      onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                    >
                      <td className="px-3 py-3 rounded-l-xl">
                        <p className="text-[10px] font-bold text-zinc-900">{t.entry_time.split('T')[0]}</p>
                        <p className="text-[10px] text-zinc-400">${t.entry_price}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[10px] font-bold text-zinc-900">{t.exit_time.split('T')[0]}</p>
                        <p className="text-[10px] text-zinc-400">${t.exit_price}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-bold text-zinc-600">{t.qty}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <span className="text-[9px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">SL: ${t.sl}</span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">TP: ${t.tp}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[9px] font-bold bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded uppercase">{t.reason}</span>
                      </td>
                      <td className="px-3 py-3 rounded-r-xl text-right">
                        <p className={cn("text-xs font-black", t.pnl >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {t.pnl >= 0 ? "+" : ""}${t.pnl?.toLocaleString()}
                        </p>
                        <p className={cn("text-[9px] font-bold opacity-60", t.pnl_pct >= 0 ? "text-emerald-500" : "text-red-500")}>
                          {t.pnl_pct}%
                        </p>
                      </td>
                    </tr>
                    {expandedIndex === i && (
                      <tr className="bg-white">
                        <td colSpan={6} className="px-3 py-4">
                          <div className="flex justify-center">
                            <TradeChartPopup 
                              ticker={ticker}
                              entryTime={t.entry_time}
                              exitTime={t.exit_time}
                              entryPrice={t.entry_price}
                              exitPrice={t.exit_price}
                              takeProfit={t.tp}
                              stopLoss={t.sl}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function StrategyLab({ 
  ticker, 
  onTickerChange 
}: { 
  ticker: string,
  onTickerChange?: (ticker: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [scannerMode, setScannerMode] = useState(false)
  const [useLiveSentiment, setUseLiveSentiment] = useState(false)
  const [results, setResults] = useState<BacktestResults | null>(null)
  const [bulkResults, setBulkResults] = useState<any | null>(null)
  const [params, setParams] = useState({
    capital: 10000,
    sl: 5,
    tp: 10,
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    strategyType: "trend"
  })
  // Popup state: which ticker's trade log is open
  const [popupTicker, setPopupTicker] = useState<string | null>(null)
  
  // Single ticker results expansion state
  const [expandedTradeIndex, setExpandedTradeIndex] = useState<number | null>(null)

  const openPopup = (tk: string) => setPopupTicker(tk)
  const closePopup = () => setPopupTicker(null)

  const getTickerTrades = (tk: string): any[] =>
    (bulkResults?.master_trade_log ?? []).filter((t: any) => t.ticker === tk)

  const runBacktest = async () => {
    setLoading(true)
    setBulkResults(null)
    setResults(null)
    
    // Sanitize dates (prevent 12024 etc)
    const sDate = params.startDate.split('-').length === 3 && params.startDate.split('-')[0].length > 4 
      ? params.startDate.split('-')[0].substring(params.startDate.split('-')[0].length - 4) + '-' + params.startDate.split('-')[1] + '-' + params.startDate.split('-')[2]
      : params.startDate;
    const eDate = params.endDate.split('-').length === 3 && params.endDate.split('-')[0].length > 4
      ? params.endDate.split('-')[0].substring(params.endDate.split('-')[0].length - 4) + '-' + params.endDate.split('-')[1] + '-' + params.endDate.split('-')[2]
      : params.endDate;

    try {
      if (scannerMode) {
        const res = await fetch(
          `http://localhost:8000/api/backtest/bulk?start_date=${sDate}&end_date=${eDate}&capital=${params.capital}&sl_pct=${params.sl/100}&tp_pct=${params.tp/100}&use_live_sentiment=${useLiveSentiment}&strategy_type=${params.strategyType}`
        )
        const data = await res.json()
        setBulkResults(data)
      } else {
        const res = await fetch(
          `http://localhost:8000/api/backtest?ticker=${ticker}&start_date=${sDate}&end_date=${eDate}&capital=${params.capital}&sl=${params.sl/100}&tp=${params.tp/100}&use_live_sentiment=${useLiveSentiment}&strategy_type=${params.strategyType}`
        )
        const data = await res.json()
        setResults(data)
      }
    } catch (error) {
      console.error("Backtest failed:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Trade Log Popup */}
      {popupTicker && (
        <TradeLogPopup
          ticker={popupTicker}
          trades={getTickerTrades(popupTicker)}
          onClose={closePopup}
        />
      )}

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <h3 className="font-bold flex items-center gap-2 text-zinc-900">
            <FlaskConical className="text-indigo-600 w-4 h-4" />
            Strategy Lab
          </h3>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-1 rounded-full font-bold uppercase tracking-tighter">Backtest Engine</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Parameters ── */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Initial Capital</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                <input 
                  type="number" 
                  value={params.capital}
                  onChange={(e) => setParams({...params, capital: Number(e.target.value)})}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-7 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* ── Strategy Selection ── */}
          <div className="space-y-1 mb-6">
            <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Logic Protocol</label>
            <div className="grid grid-cols-3 gap-2 bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200">
              {[
                { id: 'trend', label: 'TREND_MA', color: 'text-blue-600' },
                { id: 'volume', label: 'VOL_ACCUM', color: 'text-purple-600' },
                { id: 'candlestick', label: 'CANDLE_PT', color: 'text-orange-600' }
              ].map(strat => (
                <button
                  key={strat.id}
                  onClick={() => setParams({...params, strategyType: strat.id})}
                  className={cn(
                    "py-2 rounded-xl text-[10px] font-black tracking-widest transition-all",
                    params.strategyType === strat.id 
                      ? "bg-white shadow-md " + strat.color
                      : "text-zinc-400 hover:text-zinc-600"
                  )}
                >
                  {strat.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sentiment Source Toggle ── */}
          <div
            onClick={() => setUseLiveSentiment(!useLiveSentiment)}
            className={cn(
              "mb-6 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 select-none",
              useLiveSentiment
                ? "bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-100"
                : "bg-orange-50 border-orange-200"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {useLiveSentiment ? (
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                    <Wifi className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-orange-400 flex items-center justify-center shadow-sm">
                    <WifiOff className="w-4 h-4 text-white" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-black text-zinc-900">
                    {useLiveSentiment ? "LIVE SENTIMENT" : "SIMULATED SENTIMENT"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {useLiveSentiment
                      ? "Global/Local Hybrid Sentiment (yfinance/FinBERT)"
                      : "Constant score 0.75 — full historical range"}
                  </p>
                </div>
              </div>
              {/* Toggle pill */}
              <div className={cn(
                "w-12 h-6 rounded-full flex items-center transition-all duration-300 px-0.5",
                useLiveSentiment ? "bg-emerald-500 justify-end" : "bg-zinc-300 justify-start"
              )}>
                <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                <History className="w-3 h-3" /> Start Date
              </label>
              <input 
                type="date" 
                value={params.startDate}
                onChange={(e) => setParams({...params, startDate: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                <History className="w-3 h-3" /> End Date
              </label>
              <input 
                type="date" 
                value={params.endDate}
                onChange={(e) => setParams({...params, endDate: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-red-500" /> Stop Loss (%)
              </label>
              <input 
                type="number" 
                value={params.sl}
                onChange={(e) => setParams({...params, sl: Number(e.target.value)})}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                <Target className="w-3 h-3 text-emerald-500" /> Take Profit (%)
              </label>
              <input 
                type="number" 
                value={params.tp}
                onChange={(e) => setParams({...params, tp: Number(e.target.value)})}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 mb-8">
            <h4 className="text-[10px] uppercase font-bold text-zinc-400 mb-3 tracking-widest">Active Protocol Rules</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-xs text-zinc-600">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                {params.strategyType === 'trend' && 'Trend: SMA 5 crosses above SMA 20'}
                {params.strategyType === 'volume' && 'Volume: Breakout above 20D Simple Moving Average'}
                {params.strategyType === 'candlestick' && 'Patterns: Bullish Engulfing or Hammer detection'}
              </li>
              <li className="flex items-center gap-2 text-xs text-zinc-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {params.strategyType === 'volume' ? 'Gating: Accumulation/Distribution Trend confirmation' : 'Gating: AI Sentiment > 70% Confidence'}
              </li>
              <li className="flex items-center gap-2 text-xs text-zinc-600">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                Exit: Price hits SL/TP or cross down signal
              </li>
            </ul>
          </div>

          <button 
            onClick={runBacktest}
            disabled={loading}
            className="w-full bg-zinc-900 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? "SIMULATING_MARKET_UNIVERSE..." : (scannerMode ? "SCAN ENTIRE S&P 500" : "RUN STRATEGY SIMULATION")}
          </button>

          {/* ── Single ticker error ── */}
          {results && (results as any).error && (
            <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {(results as any).error}
            </div>
          )}

          {/* ── Single ticker results ── */}
          {results && !(results as any).error && (
            <div className="mt-8 pt-8 border-t border-zinc-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="text-center">
                  <p className="text-[10px] text-zinc-400 uppercase font-black">Final Equity</p>
                  <p className="text-lg font-black text-secondary">
                    ${results.summary?.final_equity?.toLocaleString() || "---"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-400 uppercase font-black">Win Rate</p>
                  <p className="text-lg font-black text-emerald-600">
                    {results.summary?.win_rate || 0}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-400 uppercase font-black">ROI</p>
                  <p className={cn("text-lg font-black", (results.summary?.roi_pct || 0) >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {results.summary?.roi_pct || 0}%
                  </p>
                </div>
              </div>

              {results.equity_curve && results.equity_curve.length > 0 && (
                <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 overflow-hidden mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-2">
                      <BarChart4 className="w-3 h-3" /> Equity Performance
                    </h4>
                    <span className="text-[10px] font-mono text-zinc-400">{results.trades?.length || 0} Trades Executed</span>
                  </div>
                  <div className="h-24 flex items-end gap-1 px-1">
                    {results.equity_curve.filter((_, i) => i % Math.max(1, Math.floor(results.equity_curve.length / 20)) === 0).map((point, i) => {
                      const initialCapital = results.summary?.initial_capital || 1
                      const height = Math.max(10, Math.min(100, ((point.equity / initialCapital) - 0.9) * 200))
                      return (
                        <div 
                          key={i} 
                          className={cn("flex-1 rounded-t-sm transition-all duration-1000", point.equity >= initialCapital ? "bg-emerald-400" : "bg-red-400")}
                          style={{ height: `${height}%`, opacity: 0.3 + (i / 20) * 0.7 }}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
              
              {results.trades && results.trades.length > 0 ? (
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-zinc-400 mb-4 tracking-wider">Trade Log (Detailed)</h4>
                  <div className="space-y-4">
                    {results.trades.slice().reverse().map((trade, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        <div 
                          onClick={() => setExpandedTradeIndex(expandedTradeIndex === i ? null : i)}
                          className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-indigo-300 transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", trade.pnl > 0 ? "bg-emerald-500" : "bg-red-500")} />
                              <span className="text-[10px] font-black uppercase text-zinc-900">{trade.exit_time}</span>
                              <span className="text-[10px] bg-zinc-200 px-1 rounded text-zinc-500 font-bold uppercase">{trade.reason}</span>
                            </div>
                            <div className="text-right">
                              <p className={cn("font-bold text-sm leading-none", trade.pnl > 0 ? "text-emerald-600" : "text-red-600")}>
                                {trade.pnl > 0 ? "+" : ""}${trade.pnl}
                              </p>
                              <p className="text-[10px] text-zinc-400 font-bold">{trade.pnl_pct}%</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[10px] border-t border-zinc-200/50 pt-2">
                            <div>
                              <p className="text-zinc-400 uppercase font-medium">Entry & Qty</p>
                              <p className="text-zinc-600 font-bold">${trade.entry_price.toFixed(2)} <span className="text-zinc-400">×{Math.floor(trade.qty)}</span></p>
                            </div>
                            <div>
                              <p className="text-zinc-400 uppercase font-medium">SL / TP</p>
                              <p className="text-zinc-600 font-bold">
                                <span className="text-red-400">${trade.sl.toFixed(2)}</span> / <span className="text-emerald-400">${trade.tp.toFixed(2)}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-zinc-400 uppercase font-medium">Exit Price</p>
                              <p className="text-zinc-600 font-bold">${trade.exit_price.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                        
                        {expandedTradeIndex === i && (
                          <div className="p-4 bg-white border border-indigo-100 rounded-2xl shadow-sm animate-in fade-in zoom-in-95 duration-200 flex justify-center">
                            <TradeChartPopup 
                              ticker={ticker}
                              entryTime={trade.entry_time}
                              exitTime={trade.exit_time}
                              entryPrice={trade.entry_price}
                              exitPrice={trade.exit_price}
                              takeProfit={trade.tp}
                              stopLoss={trade.sl}
                              backtestStart={params.startDate}
                              backtestEnd={params.endDate}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-8 flex flex-col items-center py-8 text-zinc-400">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs font-medium">No signals generated for this period</p>
                </div>
              )}
            </div>
          )}

          {/* ── Bulk / S&P 500 results ── */}
          {bulkResults && (
            <div className="mt-8 pt-8 border-t border-zinc-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {bulkResults.error ? (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
                  <p className="text-sm font-bold text-red-600">{bulkResults.error}</p>
                  <p className="text-xs text-red-400 mt-1">Try a wider date range or check your internet connection.</p>
                </div>
              ) : bulkResults.summary ? (
                <>
                  {/* Summary header */}
                  <div className="bg-indigo-600 rounded-2xl p-6 mb-8 text-white shadow-lg shadow-indigo-100">
                    <p className="text-[10px] uppercase font-bold opacity-60 mb-2">Market Scanned: S&P 500</p>
                    <div className="flex justify-between items-end">
                       <div className="flex gap-8">
                          <div>
                             <h4 className="text-3xl font-black">${bulkResults.summary.total_aggregate_pnl?.toLocaleString()}</h4>
                             <p className="text-xs font-bold text-indigo-100">Total Alpha ($)</p>
                          </div>
                          <div>
                             <h4 className="text-3xl font-black">{bulkResults.summary.market_roi}%</h4>
                             <p className="text-xs font-bold text-indigo-100">Market ROI</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-2xl font-black text-emerald-400">{bulkResults.summary.avg_win_rate}%</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Avg Win Rate</p>
                       </div>
                    </div>
                    <div className="mt-4 flex gap-6 border-t border-indigo-500 pt-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold opacity-60">Initial Capital</p>
                        <p className="text-sm font-black">${bulkResults.summary.initial_capital?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold opacity-60">Final Equity</p>
                        <p className="text-sm font-black">${bulkResults.summary.final_equity?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold opacity-60">Total Trades</p>
                        <p className="text-sm font-black">{bulkResults.summary.total_trades ?? bulkResults.master_trade_log?.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold opacity-60">Tickers Scanned</p>
                        <p className="text-sm font-black">{bulkResults.summary.tickers_scanned}</p>
                      </div>
                    </div>
                  </div>

                  {/* Top / Bottom Performers */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                      <p className="text-[10px] font-black text-emerald-700 uppercase mb-3">Top Performers</p>
                      <div className="space-y-2">
                        {bulkResults.rankings.top.map((r: any, i: number) => (
                          <div key={i} className="flex justify-between items-center">
                            <span className="text-xs font-bold text-zinc-900">{r.ticker}</span>
                            <span className="text-xs font-black text-emerald-600">{r.pnl >= 0 ? "+" : ""}${r.pnl?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                      <p className="text-[10px] font-black text-red-700 uppercase mb-3">Bottom Performers</p>
                      <div className="space-y-2">
                        {bulkResults.rankings.bottom.map((r: any, i: number) => (
                          <div key={i} className="flex justify-between items-center">
                            <span className="text-xs font-bold text-zinc-900">{r.ticker}</span>
                            <span className="text-xs font-black text-red-600">${r.pnl?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Ticker Performance Analysis (hover → popup) ── */}
                  <div className="bg-zinc-50 rounded-2xl border border-zinc-100 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        Ticker Performance Analysis ({bulkResults.summary.valid_results})
                      </p>
                      <p className="text-[9px] text-zinc-400 italic">Kliknij wiersz aby zobaczyć transakcje</p>
                    </div>
                    <div className="space-y-2">
                      {bulkResults.all_results.map((r: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => {
                            openPopup(r.ticker)
                            if (onTickerChange) onTickerChange(r.ticker)
                          }}
                          className="flex justify-between items-center p-3 bg-white border border-zinc-200 rounded-xl hover:border-indigo-400 hover:shadow-sm hover:shadow-indigo-50 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-1.5 h-6 rounded-full",
                              r.pnl >= 0 ? "bg-emerald-400" : "bg-red-400"
                            )} />
                            <span className="font-bold text-sm text-zinc-900 group-hover:text-indigo-700 transition-colors">{r.ticker}</span>
                            <span className="text-[9px] text-zinc-400">{r.trades} trades</span>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-[9px] text-zinc-400">Win Rate</p>
                              <p className="text-xs font-bold text-zinc-600">{r.win_rate ?? "—"}%</p>
                            </div>
                            <span className={cn("text-xs font-black px-2 py-1 rounded-lg", r.pnl >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50")}>
                              {r.pnl >= 0 ? "+" : ""}${r.pnl?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
