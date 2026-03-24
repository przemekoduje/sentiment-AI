"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Cpu, 
  ShieldCheck, 
  Search,
  ArrowUpRight,
  Target,
  ChevronDown,
  ChevronUp,
  Lock,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import TradeChartPopup from './TradeChartPopup'

interface MatrixItem {
  ticker: string
  price: number
  sma5: number
  sma20: number
  rsi: number
  sentiment_score: number
  sentiment_label: string
  insider_score: number
  fundamental_score: number
  fundamental_grade: string
  potential: number
  decision_action: string
  decision_reasoning: string
  timestamp: string
}

export default function LiveDecisionMatrix({ filterHighConf }: { filterHighConf?: boolean }) {
  const [items, setItems] = useState<MatrixItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scanIndex, setScanIndex] = useState(0)
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)

  const filteredItems = useMemo(() => {
    if (!filterHighConf) return items
    return items.filter(item => item.potential >= 80)
  }, [items, filterHighConf])

  const fetchMatrix = async () => {
    try {
      const res = await fetch('/api/live/matrix')
      if (!res.ok) {
        console.error(`Matrix API Error: ${res.status} ${res.statusText}`)
        setLoading(false)
        return
      }
      const data = await res.json()
      setItems(data.matrix || [])
      setLoading(false)
    } catch (error: any) {
       console.error("Matrix fetch error details:", error)
       setLoading(false)
    }
  }

  useEffect(() => {
    fetchMatrix()
    const interval = setInterval(fetchMatrix, 10000) // Fast refresh for matrix
    return () => clearInterval(interval)
  }, [])

  // Animation to simulate active scanning
  useEffect(() => {
    const timer = setInterval(() => {
        setScanIndex(prev => (prev + 1) % (items.length || 1))
    }, 2000)
    return () => clearInterval(timer)
  }, [items])

  const today = useMemo(() => new Date().toISOString(), [])
  const ninetyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString()
  }, [])

  if (loading && items.length === 0) {
    return (
        <div className="bg-white rounded-[48px] border border-zinc-200 p-12 h-[600px] flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-zinc-400 font-black uppercase tracking-[0.2em] text-xs">Calibrating Hybrid Decision Matrix</p>
            </div>
        </div>
    )
  }

  return (
    <div className="bg-white rounded-[48px] border border-zinc-200 shadow-2xl shadow-zinc-200/50 overflow-hidden relative">
      {/* Neural Network Background Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
         <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <header className="p-8 border-b border-zinc-100 flex justify-between items-center relative bg-white/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Target className="text-white w-6 h-6" />
            </div>
            <div>
                <h3 className="text-2xl font-black tracking-tight text-zinc-900 uppercase">Live Intelligence Matrix</h3>
                <p className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Processing {items.length} concurrent market vectors
                </p>
            </div>
        </div>
        <div className="hidden lg:flex items-center gap-6">
            <div className="text-right">
                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest leading-none">Scanning Node</p>
                <p className="text-sm font-bold text-indigo-600">ALPHA-Z12</p>
            </div>
            <div className="w-px h-8 bg-zinc-100" />
            <div className="bg-zinc-100 px-4 py-2 rounded-xl border border-zinc-200 flex items-center gap-3">
                <Cpu className="w-4 h-4 text-zinc-400" />
                <span className="text-[10px] font-black text-zinc-500 uppercase">Load: 12%</span>
            </div>
        </div>
      </header>

      <div className="overflow-x-auto relative z-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/50 text-[10px] font-black text-zinc-400 uppercase tracking-[0.1em] border-b border-zinc-100">
              <th className="px-8 py-4 w-12"></th>
              <th className="px-6 py-4">Security</th>
              <th className="px-6 py-4">Price / Tech</th>
              <th className="px-6 py-4">RSI Pulse</th>
              <th className="px-6 py-4">AI Sentiment</th>
              <th className="px-6 py-4">Insider / Fund</th>
              <th className="px-8 py-4 text-right">Potential Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 relative">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredItems.slice(0, 20).map((item, idx) => {
                const isScanning = idx === scanIndex
                const isBullish = item.sma5 > item.sma20
                const isExpanded = expandedTicker === item.ticker

                return (
                  <React.Fragment key={item.ticker}>
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setExpandedTicker(isExpanded ? null : item.ticker)}
                      className={cn(
                          "group hover:bg-zinc-50/80 transition-all cursor-pointer",
                          isScanning && "bg-indigo-50/30",
                          isExpanded && "bg-indigo-50/50"
                      )}
                    >
                      <td className="px-8 py-6">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-zinc-300 group-hover:text-indigo-400" />}
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                              <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center font-black text-xs shadow-sm">
                                  {item.ticker.substring(0, 2)}
                              </div>
                              {isScanning && (
                                  <motion.div 
                                      layoutId="scanner"
                                      className="absolute inset-0 border-2 border-indigo-500 rounded-xl"
                                      initial={false}
                                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                  />
                              )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900">{item.ticker}</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Node Snapshot: {item.timestamp}</p>
                          </div>
                        </div>
                      </td>

                    <td className="px-6 py-6 font-mono">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-black text-zinc-900">${item.price.toFixed(2)}</span>
                        <div className="flex items-center gap-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full", isBullish ? "bg-emerald-500" : "bg-zinc-300")} />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                                SMA 5/20 {(item.sma5 - item.sma20).toFixed(2)}
                            </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                            <span className={cn(
                                "text-xs font-black",
                                item.rsi > 70 ? "text-red-500" : item.rsi < 30 ? "text-emerald-500" : "text-zinc-600"
                            )}>
                                {item.rsi.toFixed(1)}
                            </span>
                            <div className="flex-1 h-1 w-16 bg-zinc-100 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.rsi}%` }}
                                    className={cn(
                                        "h-full rounded-full",
                                        item.rsi > 70 ? "bg-red-500" : item.rsi < 30 ? "bg-emerald-500" : "bg-indigo-500"
                                    )}
                                />
                            </div>
                        </div>
                    </td>

                    <td className="px-6 py-6">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                                    item.sentiment_label === 'positive' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                )}>
                                    {item.sentiment_label}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-400">{(item.sentiment_score * 100).toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-[2px] bg-zinc-50 rounded-full mt-1">
                                <div className="h-full bg-indigo-200" style={{ width: `${item.sentiment_score * 100}%` }} />
                            </div>
                        </div>
                    </td>

                    <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-zinc-600 uppercase">Ins: {Math.round(item.insider_score * 100)}%</span>
                                <span className="text-[10px] font-black text-indigo-600">Fund: {item.fundamental_grade}</span>
                            </div>
                        </div>
                    </td>

                    <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                                {item.decision_action !== "BUY" && item.decision_reasoning.includes("Gated:") && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-black text-amber-700 uppercase tracking-tighter shadow-sm">
                                        <Lock className="w-2.5 h-2.5" />
                                        Gated: Trend
                                    </div>
                                )}
                                {item.potential > 85 && item.decision_action === "BUY" && (
                                    <motion.div 
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                    >
                                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                    </motion.div>
                                )}
                                <span className={cn(
                                    "text-xl font-black tracking-tighter",
                                    item.decision_action !== "BUY" ? "text-zinc-400" : "text-zinc-900"
                                )}>
                                    {item.potential}%
                                </span>
                            </div>
                            <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-50 shadow-inner">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.potential}%` }}
                                    className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        item.decision_action !== "BUY" ? "bg-amber-400/50" :
                                        item.potential > 80 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                                        item.potential > 60 ? "bg-indigo-500" : "bg-zinc-300"
                                    )}
                                />
                            </div>
                            {item.decision_action !== "BUY" && (
                                <p className="text-[8px] font-bold text-amber-600/70 italic max-w-[120px] leading-tight mt-1 text-right">
                                    {item.decision_reasoning.split('|')[0].split(':')[1]?.trim() || 
                                     item.decision_reasoning.split('|')[0].trim()}
                                </p>
                            )}
                        </div>
                    </td>
                  </motion.tr>
                  {isExpanded && (
                    <motion.tr
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-indigo-50/20"
                    >
                      <td colSpan={7} className="px-8 py-8">
                        <div className="flex justify-center w-full">
                          <TradeChartPopup 
                            ticker={item.ticker}
                            entryTime={ninetyDaysAgo}
                            exitTime={today}
                            entryPrice={item.price}
                            exitPrice={item.price}
                            backtestStart={ninetyDaysAgo}
                            backtestEnd={today}
                            showTradeMarkers={false}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  )}
                </React.Fragment>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <footer className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest z-10 relative">
        <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure Feed
            </span>
            <span className="flex items-center gap-2">
                <Search className="w-3 h-3 text-zinc-300" /> Scanning S&P 100 Core
            </span>
        </div>
        <p className="italic">Data serialized at millisecond latency</p>
      </footer>
    </div>
  )
}
