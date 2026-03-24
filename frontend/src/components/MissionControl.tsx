"use client"

import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Activity, 
  DollarSign, 
  Cpu,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import StrategyLab from './StrategyLab'
import MarketSelector from './MarketSelector'

interface NewsItem {
  title: string
  url: string
  time_published: string
  summary: string
  banner_image: string | null
  ticker_sentiment: {
    ticker: string
    ticker_sentiment_label: string
    ticker_sentiment_score: string
    relevance_score: string
  }[]
}

interface Signal {
  ticker: string
  current_price: number
  change_pct?: number
  signal: string
  confidence: number
  sentiment_label: string
  sentiment_score?: number
  local_sentiment_label?: string
  local_sentiment_score?: number
  technical_signal: string
  reasoning: string
  is_confident: boolean
  timestamp: string
  news_feed?: NewsItem[]
}

interface MissionControlProps {
  ticker?: string
}

export default function MissionControl({ ticker: initialTicker = "AAPL" }: MissionControlProps) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTicker, setActiveTicker] = useState(initialTicker)
  const [autoPilot, setAutoPilot] = useState(false)

  const fetchAutoPilotStatus = async () => {
    try {
      const res = await fetch('/api/autopilot')
      const data = await res.json()
      setAutoPilot(data.enabled)
    } catch (err) {
      console.error("Failed to fetch autopilot status:", err)
    }
  }

  const fetchSignals = async (ticker: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/signals?ticker=${ticker}`)
      if (!res.ok) throw new Error(`API Error: ${res.status}`)
      const data = await res.json()
      setSignals((prev) => {
        const filtered = prev.filter(s => s.ticker !== ticker)
        return [data, ...filtered]
      })
    } catch (error) {
      console.error("Failed to fetch signals:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialTicker) {
      setActiveTicker(initialTicker)
      fetchSignals(initialTicker)
    }
  }, [initialTicker])

  useEffect(() => {
    fetchSignals("TSLA")
    fetchSignals("BTC-USD")
    fetchAutoPilotStatus()
    
    const interval = setInterval(fetchAutoPilotStatus, 5000)

    const handleToggleEvent = (e: any) => {
      setAutoPilot(e.detail)
    }
    window.addEventListener('autopilot-toggle', handleToggleEvent)

    return () => {
      clearInterval(interval)
      window.removeEventListener('autopilot-toggle', handleToggleEvent)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#18181B] p-6 lg:p-8 font-sans">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-light tracking-tight flex items-center gap-3">
            <Cpu className="text-blue-600 w-8 h-8" />
            Sentiment <span className="font-bold text-blue-600">AI</span>
          </h1>
          <p className="text-zinc-500 mt-2">Hybrid Intelligence Trading Terminal</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-all animate-in fade-in slide-in-from-right-4",
            autoPilot 
              ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-200" 
              : "bg-zinc-100 text-zinc-500 border-zinc-200"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              autoPilot ? "bg-white animate-pulse" : "bg-zinc-400"
            )} />
            {autoPilot ? "AUTO-PILOT ACTIVE" : "MANUAL MODE"}
          </div>

          <MarketSelector onMarketChange={() => {
             // Reset UI and force a refresh
             setSignals([])
             fetchSignals(activeTicker)
          }} />
          <button 
            onClick={() => fetchSignals(activeTicker)}
            className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-zinc-200 shadow-sm hover:bg-zinc-50 transition-colors text-zinc-700 font-medium h-[42px]"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Sync Terminal
          </button>
        </div>
      </header>

      {/* Bento Grid layout - Optimized for 3 cols without Strategy Lab */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-[200px]">
        
        {/* Main Ticker Card */}
        <div className="lg:col-span-2 lg:row-span-2 bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-zinc-900">
            <BarChart3 size={120} />
          </div>
          <div className="z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2 block">System Alpha Pulse</span>
            <div className="flex items-center gap-4 mb-4">
              <input 
                type="text"
                value={activeTicker}
                onChange={(e) => setActiveTicker(e.target.value.toUpperCase())}
                className="text-6xl font-black tracking-tighter text-zinc-900 bg-transparent border-none focus:outline-none focus:ring-0 w-48"
                placeholder="TICKER"
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-medium text-zinc-600">
                ${signals.find(s => s.ticker === activeTicker)?.current_price || "---"}
              </span>
              {(() => {
                const signal = signals.find(s => s.ticker === activeTicker);
                const change = signal?.change_pct || 0;
                const isPositive = change >= 0;
                return (
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-md border font-bold",
                    isPositive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"
                  )}>
                    {isPositive ? "+" : ""}{change.toFixed(2)}% LIVE
                  </span>
                );
              })()}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-8 z-10">
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 flex flex-col justify-between">
              <p className="text-xs text-zinc-500 mb-2">AI Sentiment Intelligence</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Market Intelligence:</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-black uppercase",
                      signals.find(s => s.ticker === activeTicker)?.sentiment_label === 'positive' ? "text-emerald-600" :
                      signals.find(s => s.ticker === activeTicker)?.sentiment_label === 'negative' ? "text-red-600" : "text-zinc-500"
                    )}>
                      {signals.find(s => s.ticker === activeTicker)?.sentiment_label || "---"}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {Math.round((signals.find(s => s.ticker === activeTicker)?.sentiment_score || 0) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Local FinBERT:</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-black uppercase",
                      signals.find(s => s.ticker === activeTicker)?.local_sentiment_label === 'positive' ? "text-blue-600" :
                      signals.find(s => s.ticker === activeTicker)?.local_sentiment_label === 'negative' ? "text-red-500" : "text-zinc-500"
                    )}>
                      {signals.find(s => s.ticker === activeTicker)?.local_sentiment_label || "---"}
                    </span>
                    <span className="text-[10px] font-mono text-blue-400 font-bold">
                      {Math.round((signals.find(s => s.ticker === activeTicker)?.local_sentiment_score || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
              <p className="text-xs text-zinc-500 mb-1">Tech Pulse</p>
              <p className="text-2xl font-bold text-zinc-900">
                {signals.find(s => s.ticker === activeTicker)?.technical_signal || "---"}
              </p>
            </div>
          </div>
        </div>

        {/* Signal Log */}
        <div className="lg:col-span-1 lg:row-span-2 bg-white rounded-3xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h3 className="font-bold flex items-center gap-2 text-zinc-900">
              <Activity className="text-emerald-600 w-4 h-4" />
              Unified Market Trade Log
            </h3>
            <span className="text-[10px] bg-white border border-zinc-200 px-2 py-1 rounded-full text-zinc-500 font-mono italic">DECRYPTING_REAL_TIME...</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading && signals.length === 0 ? (
               <div className="p-4 space-y-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-16 bg-zinc-50 rounded-xl animate-pulse" />
                  ))}
               </div>
            ) : (
              signals.map((signal, idx) => (
                <div key={idx} className="p-4 hover:bg-zinc-50 rounded-2xl flex items-center justify-between group transition-all cursor-pointer" onClick={() => signal.ticker && setActiveTicker(signal.ticker)}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-black",
                      signal.signal === "BUY" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {signal.ticker?.substring(0, 2) || "??"}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{signal.ticker || "UNKNOWN"}</p>
                      <p className="text-[10px] text-zinc-400 font-medium">Last analysis: {signal.timestamp ? new Date(signal.timestamp).toLocaleTimeString() : "---"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-black", signal.signal === "BUY" ? "text-emerald-600" : "text-red-600")}>{signal.signal}</p>
                    <p className="text-[10px] text-zinc-400 font-mono uppercase">Conf: {Math.round(signal.confidence * 100)}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* News Feed - Market Intelligence */}
        <div className="lg:col-span-2 lg:row-span-2 bg-white rounded-3xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h3 className="font-bold flex items-center gap-2 text-zinc-900">
              <TrendingUp className="text-blue-600 w-4 h-4" />
              Market Intelligence Feed: {activeTicker}
            </h3>
            <span className="text-[10px] bg-blue-50 border border-blue-100 px-2 py-1 rounded-full text-blue-600 font-bold">LIVE_MARKET_NEWS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {(() => {
              const activeSignal = signals.find(s => s.ticker === activeTicker);
              const newsFeed = activeSignal?.news_feed;

              if (newsFeed && newsFeed.length > 0) {
                return newsFeed.map((news, idx) => {
                  const tickerSentiment = news.ticker_sentiment?.find(ts => ts.ticker === activeTicker);
                  const sentimentLabel = tickerSentiment?.ticker_sentiment_label || "Neutral";
                  const sentimentScore = parseFloat(tickerSentiment?.ticker_sentiment_score || "0");
                  const relevanceScore = parseFloat(tickerSentiment?.relevance_score || "0");
                  
                  const isBullish = sentimentLabel.includes("Bullish");
                  const isBearish = sentimentLabel.includes("Bearish");

                  let formattedDate = "Recent";
                  try {
                    formattedDate = new Date(news.time_published.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  } catch (e) {
                    console.error("Date parse error", e);
                  }

                  return (
                    <a 
                      key={idx} 
                      href={news.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block p-5 rounded-3xl bg-zinc-50 hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50 transition-all border border-zinc-100 group"
                    >
                      <div className="flex justify-between items-start gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="text-[10px] uppercase font-black text-zinc-400 tracking-widest">
                              {formattedDate}
                            </p>
                            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-zinc-100 text-zinc-400">
                              <span className="text-[9px] font-bold">Rel:</span>
                              <span className="text-[9px] font-black text-zinc-600">{Math.round(relevanceScore * 100)}%</span>
                            </div>
                          </div>
                          <h4 className="font-black text-base text-zinc-900 leading-tight group-hover:text-blue-600 transition-colors mb-2">
                            {news.title}
                          </h4>
                          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 italic">
                            {news.summary}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-black shadow-sm",
                            isBullish ? "bg-emerald-500 text-white shadow-emerald-100" : 
                            isBearish ? "bg-red-500 text-white shadow-red-100" : "bg-zinc-200 text-zinc-600"
                          )}>
                            {sentimentLabel.toUpperCase()}
                          </div>
                          <div className="text-[9px] font-mono text-zinc-400">
                            SCORE: {sentimentScore.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                });
              }

              return (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-3 py-12">
                  <AlertCircle className="w-10 h-10 opacity-20" />
                  <p className="text-sm italic font-medium">Gathering intelligence from global terminals...</p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* System Health & Meta */}
        <div className="md:row-span-1 flex flex-col gap-4">
          <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm flex-1 flex flex-col justify-between">
            <p className="text-xs text-zinc-500">FinBERT Bridge</p>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-bold text-emerald-600">OPERATIONAL</span>
            </div>
          </div>
          <div className="bg-blue-600 rounded-3xl p-6 flex flex-col justify-between shadow-xl shadow-blue-200/50 flex-1">
             <DollarSign className="text-blue-100" />
             <div>
                <p className="text-xs text-blue-100 italic">Level 1 Integration</p>
                <h4 className="text-sm font-bold leading-tight mt-1 text-white uppercase tracking-tighter">Hybrid Data Stream</h4>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
