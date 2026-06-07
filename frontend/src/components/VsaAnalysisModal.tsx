"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  Maximize2, 
  BarChart3, 
  ShieldCheck,
  Zap,
  RefreshCw,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VsaAnalysisData {
  ticker: string
  interval: string
  recommendation: string
  reasoning: string
  trading_plan: {
    entry: number
    stop_loss: number
    take_profit: number
    risk_reward: number
  } | null
  vsa_metrics: {
    rel_vol: number
    rel_spread: number
    close_pos: number
  }
  anomalies: any[]
  chart_base64: string
  cached?: boolean
}

export default function VsaAnalysisModal({ 
  ticker, 
  isOpen, 
  onClose 
}: { 
  ticker: string, 
  isOpen: boolean, 
  onClose: () => void 
}) {
  const [data, setData] = useState<VsaAnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVsa = async () => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vsa/analysis/${ticker}`)
      if (!res.ok) throw new Error("VSA Engine Offline")
      const result = await res.json()
      setData(result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && ticker) {
      fetchVsa()
    } else {
      setData(null)
    }
  }, [isOpen, ticker])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[40px] border border-zinc-200 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                 <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight leading-none">VSA MACRO INSIGHT</h3>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">{ticker}</span>
                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Phase: Accumulation/Distribution Analysis</span>
                </div>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              {data?.cached && (
                 <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cached Result (4h)</span>
                 </div>
              )}
              <button 
                onClick={onClose} 
                className="w-10 h-10 rounded-full hover:bg-zinc-200 flex items-center justify-center transition-colors bg-zinc-100"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
           {loading ? (
              <div className="flex flex-col items-center justify-center h-[500px]">
                 <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                 <p className="text-sm font-black text-zinc-400 uppercase tracking-widest animate-pulse">Scanning Microstructure...</p>
              </div>
           ) : error ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-center">
                 <AlertCircle className="w-16 h-16 text-red-500 mb-4 opacity-20" />
                 <h4 className="text-xl font-black text-zinc-900 uppercase">Engine Failure</h4>
                 <p className="text-zinc-500 mt-2 max-w-xs">{error}. Please ensure the backend is running and data is available for this ticker.</p>
                 <button 
                   onClick={fetchVsa}
                   className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-indigo-100"
                 >
                    Retry Analysis
                 </button>
              </div>
           ) : data && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* Left: Chart Visualization */}
                 <div className="lg:col-span-2 space-y-6">
                    <div className="bg-zinc-900 rounded-[32px] overflow-hidden border border-zinc-800 shadow-2xl relative group">
                       {data.chart_base64 ? (
                          <img 
                            src={`data:image/png;base64,${data.chart_base64}`} 
                            alt={`VSA Analysis for ${ticker}`}
                            className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700"
                          />
                       ) : (
                          <div className="h-[400px] flex items-center justify-center">
                             <TrendingUp className="w-12 h-12 text-zinc-700 animate-pulse" />
                             <p className="text-zinc-600 ml-4 font-black uppercase tracking-widest">Chart unavailable in current bias</p>
                          </div>
                       )}
                       <div className="absolute top-6 left-6 flex gap-2">
                          <div className="px-3 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             <span className="text-[10px] font-black text-white uppercase tracking-widest">LIVE DATA FEED</span>
                          </div>
                       </div>
                    </div>
                    
                    {/* Reasoning Block */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-8 opacity-10">
                          <Brain className="w-24 h-24 text-indigo-600" />
                       </div>
                       <h4 className="text-lg font-black text-indigo-900 uppercase flex items-center gap-2 mb-4">
                          <Zap className="w-5 h-5" />
                          Machine Reasoning
                       </h4>
                       <p className="text-indigo-800 leading-relaxed font-medium">
                          {data.reasoning}
                       </p>
                       
                       <div className="mt-6 grid grid-cols-3 gap-4">
                          <div className="bg-white/50 rounded-2xl p-4 border border-indigo-100">
                             <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Normalized Vol</p>
                             <p className="text-lg font-black text-indigo-900">{data.vsa_metrics.rel_vol}x</p>
                          </div>
                          <div className="bg-white/50 rounded-2xl p-4 border border-indigo-100">
                             <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Rel. Spread</p>
                             <p className="text-lg font-black text-indigo-900">{data.vsa_metrics.rel_spread}x</p>
                          </div>
                          <div className="bg-white/50 rounded-2xl p-4 border border-indigo-100">
                             <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Close Pos</p>
                             <p className="text-lg font-black text-indigo-900">{(data.vsa_metrics.close_pos * 100).toFixed(0)}%</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Right: Recommendation & Trading Plan */}
                 <div className="space-y-6">
                    <div className={cn(
                       "rounded-[32px] p-8 border shadow-xl flex flex-col items-center text-center",
                       data.recommendation === 'BUY' ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-200" :
                       data.recommendation === 'SELL' ? "bg-red-600 border-red-500 text-white shadow-red-200" :
                       "bg-zinc-900 border-zinc-800 text-white shadow-zinc-200"
                    )}>
                       <p className="text-[12px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">MACRO_BIAS</p>
                       <h3 className="text-5xl font-black mb-4 tracking-tighter">{data.recommendation}</h3>
                       <div className="w-full h-px bg-white/20 mb-6" />
                       <p className="text-[11px] font-bold leading-relaxed opacity-90">
                          {data.recommendation === 'BUY' ? "Strong absorption of professional supply detected. Confirmed SOS at structural demand." :
                           data.recommendation === 'SELL' ? "Distribution phase confirmed. Exhaustion of demand near supply overflow." :
                           "Market in equilibrium. No clear dominance from Smart Money detected in this interval."}
                       </p>
                    </div>

                    {data.trading_plan ? (
                       <div className="bg-white border border-zinc-200 rounded-[32px] p-8 shadow-sm">
                          <h4 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                             <ShieldCheck className="w-4 h-4 text-emerald-500" />
                             Validated Trading Plan
                          </h4>
                          
                          <div className="space-y-4">
                             <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl">
                                <span className="text-[10px] font-black text-zinc-400 uppercase">Target Entry</span>
                                <span className="text-lg font-black text-zinc-900">${data.trading_plan.entry}</span>
                             </div>
                             <div className="flex justify-between items-center p-4 bg-red-50 rounded-2xl border border-red-100">
                                <span className="text-[10px] font-black text-red-400 uppercase">Stop Loss</span>
                                <span className="text-lg font-black text-red-900">${data.trading_plan.stop_loss}</span>
                             </div>
                             <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600">
                                <span className="text-[10px] font-black text-emerald-400 uppercase">Take Profit</span>
                                <span className="text-lg font-black text-emerald-900">${data.trading_plan.take_profit}</span>
                             </div>
                             <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                                <span className="text-[10px] font-black text-zinc-400 uppercase">Risk Reward Ratio</span>
                                <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-xs font-black">
                                   {data.trading_plan.risk_reward}:1
                                </span>
                             </div>
                          </div>
                       </div>
                    ) : (
                       <div className="bg-zinc-50 border border-zinc-100 rounded-[32px] p-12 text-center">
                          <Info className="w-8 h-8 text-zinc-300 mx-auto mb-4" />
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-loose">
                             Trading plan restricted until structural anomaly confirms entry requirements.
                          </p>
                       </div>
                    )}
                    
                    <button 
                      onClick={onClose}
                      className="w-full py-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-[32px] font-black text-xs uppercase transition-all"
                    >
                       Dismiss Analysis
                    </button>
                 </div>
              </div>
           )}
        </div>
      </motion.div>
    </div>
  )
}

function Brain(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.13 6 6 0 0 0 11.977-1.125A4 4 0 0 0 16.5 5h-4.5Z" />
      <path d="M9 13a4.5 4.5 0 0 0 3-4" />
      <path d="M6.003 5.125A3 3 0 1 1 12 5m4.5 0A4.5 4.5 0 0 1 21 9.5 4.5 4.5 0 0 1 16.5 14" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </svg>
  )
}
