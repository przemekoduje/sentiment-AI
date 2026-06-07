"use client"

import React, { useState, useEffect } from 'react'
import { 
  Search, 
  ArrowRight, 
  Calendar, 
  BarChart3, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StrategyAuditorProps {
  ticker: string
  onTickerChange: (ticker: string) => void
}

interface VsaAuditData {
  ticker: string
  interval: string
  recommendation: string
  reasoning: string
  vsa_metrics: {
    rel_vol: number
    rel_spread: number
    close_pos: number
  }
  anomalies: any[]
  chart_base64: string
  trading_plan?: any
}

const INTERVALS = ["1h", "4h", "1d", "1w"]

export default function StrategyAuditor({ ticker, onTickerChange }: StrategyAuditorProps) {
  const [data, setData] = useState<VsaAuditData | null>(null)
  const [loading, setLoading] = useState(false)
  const [interval, setInterval] = useState("1d")
  const [error, setError] = useState<string | null>(null)
  const [searchTicker, setSearchTicker] = useState(ticker)

  const fetchAudit = async (targetTicker: string, targetInterval: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vsa/audit/${targetTicker}?interval=${targetInterval}&plot_length=150`)
      if (!res.ok) throw new Error("Failed to fetch VSA audit trail")
      const result = await res.json()
      if (result.error) {
        setError(result.error)
        setData(null)
      } else {
        setData(result)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAudit(ticker, interval)
  }, [ticker, interval])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTicker) {
      onTickerChange(searchTicker.toUpperCase())
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[32px] border border-zinc-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider border border-indigo-100">
              Strategy Auditor v2.0
            </div>
          </div>
          <h2 className="text-4xl font-black tracking-tight text-zinc-900">VSA Strategy <span className="text-indigo-600">Auditor</span></h2>
          <p className="text-zinc-500 font-medium max-w-xl">
            Visual backtesting & deep microstructure analysis. Detects "Smart Money" footprints across historical data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-hover:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              placeholder="Enter ticker (e.g. NVDA)..."
              className="pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all w-64"
            />
          </form>

          <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200">
            {INTERVALS.map(int => (
              <button
                key={int}
                onClick={() => setInterval(int)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all",
                  interval === int 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {int}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] border border-zinc-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">Macro VSA Audit Trail</h3>
                  <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">{ticker} — {interval} (Last 150 Bars)</p>
                </div>
              </div>
              {loading && <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />}
            </div>
            
            <div className="aspect-[16/10] bg-zinc-50 relative flex items-center justify-center group overflow-hidden">
               {data?.chart_base64 ? (
                 <img 
                   src={`data:image/png;base64,${data.chart_base64}`} 
                   className="w-full h-full object-contain p-4 hover:scale-105 transition-transform duration-700 cursor-zoom-in"
                   alt="VSA Audit Chart"
                 />
               ) : loading ? (
                 <div className="flex flex-col items-center gap-4">
                    <Activity className="w-12 h-12 text-indigo-600 animate-pulse" />
                    <p className="text-sm font-black text-zinc-400 uppercase tracking-widest animate-pulse">Rendering deep audit trail...</p>
                 </div>
               ) : (
                 <p className="text-zinc-400 font-medium">No data available for {ticker}</p>
               )}
            </div>

            <div className="p-6 bg-indigo-50/30 border-t border-zinc-100">
               <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                    <span className="text-[10px] font-black uppercase text-zinc-600">Stopping Volume</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <span className="text-[10px] font-black uppercase text-zinc-600">Climax Sign</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                    <span className="text-[10px] font-black uppercase text-zinc-600">No Supply</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                    <span className="text-[10px] font-black uppercase text-zinc-600">No Demand</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm space-y-4">
             <div className="flex items-center gap-3 mb-4">
                <Info className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-black text-zinc-900 uppercase tracking-tight">Strategy Reasoning</h3>
             </div>
             <p className="text-zinc-700 font-medium leading-relaxed italic">
               {data?.reasoning || (loading ? "Analyzing historical structure..." : "Select a ticker to begin audit.")}
             </p>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8 text-zinc-900">
           {/* Current Bias Card */}
           <div className={cn(
             "rounded-[32px] p-8 border shadow-lg transition-all duration-500",
             data?.recommendation === 'BUY' ? "bg-emerald-50 border-emerald-200 shadow-emerald-100" :
             data?.recommendation === 'SELL' ? "bg-rose-50 border-rose-200 shadow-rose-100" :
             "bg-white border-zinc-200 shadow-zinc-100"
           )}>
             <div className="flex items-center justify-between mb-8">
               <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Macro Bias</span>
               <div className={cn(
                 "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border",
                 data?.recommendation === 'BUY' ? "bg-emerald-500 text-white border-emerald-400" :
                 data?.recommendation === 'SELL' ? "bg-rose-500 text-white border-rose-400" :
                 "bg-zinc-100 text-zinc-500 border-zinc-200"
               )}>
                 {data?.recommendation || "Analysing..."}
               </div>
             </div>
             
             <div className="flex flex-col items-center gap-3 mb-8">
                {data?.recommendation === 'BUY' ? (
                  <TrendingUp className="w-16 h-16 text-emerald-500" />
                ) : data?.recommendation === 'SELL' ? (
                  <TrendingDown className="w-16 h-16 text-rose-500" />
                ) : (
                  <Activity className="w-16 h-16 text-zinc-300" />
                )}
                <div className="text-center">
                   <h4 className="text-3xl font-black">{data?.recommendation === 'HOLD' ? "WAIT" : data?.recommendation || "---"}</h4>
                   <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Recommended Action</p>
                </div>
             </div>

             {data?.trading_plan && data.recommendation !== 'HOLD' && (
               <div className="space-y-4 pt-6 border-t border-zinc-200/50">
                  <div className="flex justify-between items-center bg-white/50 p-3 rounded-2xl border border-white">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Entry Target</span>
                    <span className="text-sm font-black">${data.trading_plan.entry}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/50 p-3 rounded-2xl border border-white">
                    <span className="text-[10px] font-black uppercase text-rose-500">Stop Loss</span>
                    <span className="text-sm font-black text-rose-600">${data.trading_plan.stop_loss}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/50 p-3 rounded-2xl border border-white">
                    <span className="text-[10px] font-black uppercase text-emerald-600">Take Profit</span>
                    <span className="text-sm font-black text-emerald-600">${data.trading_plan.take_profit}</span>
                  </div>
               </div>
             )}
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">Vol / Avg</p>
                <p className="text-xl font-black">{data?.vsa_metrics?.rel_vol ?? "0.0"}x</p>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">Spread / ATR</p>
                <p className="text-xl font-black">{data?.vsa_metrics?.rel_spread ?? "0.0"}x</p>
              </div>
           </div>

           {/* Recent Anomalies Log */}
           <div className="bg-white rounded-[32px] border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h4 className="text-[11px] font-black text-zinc-900 uppercase tracking-widest">Audit Trail Log</h4>
                <div className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-bold">
                  {data?.anomalies.length || 0} Events
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                 {data?.anomalies.map((a, i) => (
                   <div key={i} className="flex flex-col p-3 hover:bg-zinc-50 rounded-2xl transition-colors cursor-help group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-zinc-400">{a.date}</span>
                        <div className="flex gap-1">
                          {a.tags.map((t: string) => (
                            <span key={t} className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[9px] font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-zinc-700">${a.price}</span>
                        <span className="text-[10px] text-zinc-400 font-medium italic group-hover:text-indigo-600 transition-colors">Vol: {a.rel_vol}x</span>
                      </div>
                   </div>
                 ))}

                 {(!data?.anomalies || data.anomalies.length === 0) && !loading && (
                   <div className="p-8 text-center">
                     <AlertCircle className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                     <p className="text-xs text-zinc-400 font-medium">No clean VSA signals found in this range.</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
