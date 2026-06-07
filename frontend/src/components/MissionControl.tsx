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
  RefreshCw,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import MarketSelector from './MarketSelector'
import ActivePositions from './ActivePositions'

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
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
            <Cpu className="text-blue-600 w-8 h-8" />
            Mission Control <span className="text-zinc-400 font-light">v2.0</span>
          </h1>
          <p className="text-zinc-500 mt-1 font-medium italic">Strategic Command & Institutional VSA Auditor</p>
        </div>
        <div className="flex gap-4 items-center">
            {/* Auto-Pilot Badge */}
            <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-2xl border font-bold text-[10px] transition-all",
                autoPilot 
                ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-100" 
                : "bg-zinc-100 text-zinc-500 border-zinc-200"
            )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", autoPilot ? "bg-white animate-pulse" : "bg-zinc-400")} />
                {autoPilot ? "AUTO-PILOT ACTIVE" : "MANUAL MODE"}
            </div>
            
            <MarketSelector onMarketChange={() => {
                setSignals([])
                fetchSignals(activeTicker)
            }} />

            <button 
                onClick={() => fetchSignals(activeTicker)}
                className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm hover:bg-zinc-50 transition-colors text-zinc-700 font-bold text-xs h-[40px]"
            >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                Sync Logic
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Risk Monitor (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
            <ActivePositions />
        </div>

        {/* Right Column: Intelligence Feed (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-[40px] border border-zinc-200 shadow-sm flex flex-col overflow-hidden max-h-[1000px]">
            <header className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
                <h3 className="font-black text-sm uppercase tracking-[0.2em] flex items-center gap-2 text-zinc-900">
                    <Activity className="text-blue-600 w-4 h-4" />
                    Global Intel Feed
                </h3>
                <span className="text-[9px] bg-white border border-zinc-200 px-3 py-1 rounded-full text-zinc-400 font-black animate-pulse uppercase tracking-tighter">Syncing_Terminals</span>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {(() => {
                    const activeSignal = signals.find(s => s.ticker === activeTicker);
                    const newsFeed = activeSignal?.news_feed;
                    if (!newsFeed || newsFeed.length === 0) return (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-300 py-20 italic">
                            <AlertCircle className="w-10 h-10 mb-4 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">Awaiting News Stream...</p>
                        </div>
                    );
                    return newsFeed.map((news, idx) => (
                        <a key={idx} href={news.url} target="_blank" rel="noopener noreferrer" className="block p-5 rounded-[32px] bg-zinc-50 hover:bg-white hover:shadow-xl hover:shadow-zinc-200/40 transition-all border border-transparent hover:border-zinc-100 group">
                            <h4 className="font-black text-xs text-zinc-900 leading-tight group-hover:text-blue-600 transition-colors mb-3">{news.title}</h4>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">{new Date().toLocaleDateString()}</span>
                                <div className="px-2 py-1 bg-white rounded-lg border border-zinc-100 text-[9px] font-black text-blue-600 uppercase tracking-tighter">Read Intel</div>
                            </div>
                        </a>
                    ));
                })()}
            </div>
        </div>
      </div>
      
      {/* Footer / System Health */}
      <footer className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-black uppercase text-zinc-400">FinBERT Bridge: Operational</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 flex items-center gap-3">
              <Activity className="w-4 h-4 text-blue-500" />
              <p className="text-[10px] font-black uppercase text-zinc-400">Stream: High-Freq Enabled</p>
          </div>
      </footer>
    </div>
  )
}
