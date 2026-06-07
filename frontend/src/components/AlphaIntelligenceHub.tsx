"use client"

import React from 'react'
import { 
  Zap,
  Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Lazy-loaded visual components from the new architecture
import MissionControlView from './MissionControlView'
import RealTimeIntelCard from './RealTimeIntelCard'
import VsaDeepAuditReport from './VsaDeepAuditReport'

interface AlphaIntelligenceHubProps {
  ticker: string
  onTickerSelect: (ticker: string) => void
}

export default function AlphaIntelligenceHub({ ticker, onTickerSelect }: AlphaIntelligenceHubProps) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    async function fetchDeepAnalysis() {
      setData(null) // Reset stale data
      setLoading(true)
      try {
        const res = await fetch(`/api/intelligence/reasoning/${ticker}`)
        if (res.ok) {
          const detail = await res.json()
          setData(detail)
        }
      } catch (err) {
        console.error("Failed to fetch deep analysis:", err)
      } finally {
        setLoading(false)
      }
    }

    if (ticker) {
      fetchDeepAnalysis()
    }
  }, [ticker])

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Top Section: Real-time Intel Header */}
      <RealTimeIntelCard 
        ticker={ticker}
        onTickerChange={onTickerSelect}
        price={data?.quant?.current_price || "---"}
        change={data?.quant?.change_pct || 0}
        signal={data?.decision?.recommendation}
        sentiment={data?.quant?.sentiment_label || "NEUTRAL"}
      />

      {/* Narrative Section: VSA Deep Research */}
      <div className="w-full">
        {/* Ticker Selector Bar (Top 10 Key Companies) */}
        <div className="flex flex-wrap gap-2 mb-8 bg-zinc-100/50 p-2 rounded-2xl border border-zinc-200">
          {["TSLA", "AAPL", "NVDA", "MSFT", "GOOGL", "AMZN", "META", "AMD", "PLTR", "MSTR"].map(t => (
            <button
              key={t}
              onClick={() => onTickerSelect(t)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all",
                ticker === t 
                  ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200 scale-105" 
                  : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200/50"
              )}
            >
              {t}
            </button>
          ))}
          <div className="h-8 w-px bg-zinc-200 mx-2" />
          <input 
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none focus:outline-none text-[10px] font-bold uppercase w-20 px-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onTickerSelect((e.target as HTMLInputElement).value.toUpperCase())
                ;(e.target as HTMLInputElement).value = ""
              }
            }}
          />
        </div>

        <header className="flex items-center gap-4 mb-10 pl-2">
            <div className="bg-zinc-900 p-2 rounded-xl">
                <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-[0.2em]">Institutional Lens v2.5</h3>
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Głęboka Analiza Systemowa (VSA & Wyckoff Logic)</p>
                    <div className="h-3 w-px bg-zinc-200 mx-1" />
                    <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-blue-100">
                        Bidirectional Strategy Mandate
                    </span>
                </div>
            </div>
        </header>

        <VsaDeepAuditReport 
          ticker={ticker}
          analysisText={data?.deep_analysis} 
          ohlcv={data?.ohlcv}
          anomalies={data?.structural}
          loading={loading}
        />
      </div>
    </div>
  )
}
