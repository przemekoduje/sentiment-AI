"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Briefcase,
  Zap,
  Bell,
  Award,
  X,
  Info,
  TrendingUp,
  Brain,
  Lock,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LiveSignal {
  ticker: string
  company: string
  action: 'BUY' | 'SELL'
  size: number
  price: number
  confidence: number
  time: string
  status: 'FILLED' | 'PENDING' | 'ERROR' | 'LIVE'
  insider_score?: number
  fundamental_grade?: string
  signal_id?: number
}

export default function DiscoveryRadar({ 
  onTickerChange,
  filterHighConf,
  setFilterHighConf,
  isAutoPilot,
  setIsAutoPilot
}: { 
  onTickerChange: (ticker: string) => void,
  filterHighConf: boolean,
  setFilterHighConf: (v: boolean) => void,
  isAutoPilot: boolean,
  setIsAutoPilot: (v: boolean) => void
}) {
  const [signals, setSignals] = useState<LiveSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [radarError, setRadarError] = useState<string | null>(null)
  const [performance, setPerformance] = useState<any>({
    total_trades_24h: 0,
    win_rate: 0,
    net_pnl: 0,
    active_positions_count: 0,
    trade_log: []
  })

  const [activeTab, setActiveTab] = useState<'live' | 'closed'>('live')
  // Removed local state, now using props
  
  // Manual Trade Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [manualTicker, setManualTicker] = useState('')
  const [manualAction, setManualAction] = useState<'BUY' | 'SELL'>('BUY')

  const fetchDiscovery = async () => {
    if (loading && !signals.length) setLoading(true)
    
    // Simple Circuit Breaker to avoid spamming console
    if ((window as any)._last_fetch_failed && Date.now() - (window as any)._last_fetch_failed < 15000) {
      return
    }

    try {
      const [res, perfRes] = await Promise.all([
        fetch('/api/live/discovery?limit=30'),
        fetch('/api/live/performance')
      ])

      if (!res.ok || !perfRes.ok) {
        setRadarError("API Offline")
        return
      }
      
      (window as any)._last_fetch_failed = null
      const data = await res.json()
      const perfData = await perfRes.json()
      
      setPerformance(perfData)

      if (data.status === 'scanning') {
        setIsScanning(true)
        // Keep manual signals even while scanning
        setSignals(prev => {
          const dismissed = JSON.parse(localStorage.getItem('dismissed_signals') || '[]') as string[]
          const dismissedUpper = dismissed.map((s: string) => s.toUpperCase())
          return prev.filter(s => (s as any).isManual && s.ticker && !dismissedUpper.includes(s.ticker.toUpperCase()))
        })
      } else {
        setIsScanning(false)
        const newSignals = data.signals || []
        
        // 1. Keep manual signals and merge with new ones, ensuring blacklist is respected
        setSignals(prev => {
          const dismissed = JSON.parse(localStorage.getItem('dismissed_signals') || '[]') as string[]
          const dismissedUpper = dismissed.map((s: string) => s.toUpperCase())
          
          const visibleNewSignals = newSignals.filter((s: any) => s.ticker && !dismissedUpper.includes(s.ticker.toUpperCase()))
          
          const manualOnly = prev.filter(s => (s as any).isManual && s.ticker && !dismissedUpper.includes(s.ticker.toUpperCase()))
          const filteredManual = manualOnly.filter(ms => !visibleNewSignals.some((ds: any) => (ds.ticker || "").toUpperCase() === ms.ticker.toUpperCase()))
          
          return [...visibleNewSignals, ...filteredManual]
        })
      }
    } catch (err) {
      console.warn("API Connection Lost: Auto-Pilot & Matrix Polling Gated (15s)")
      setRadarError(null) // Don't show scary error to user
      ;(window as any)._last_fetch_failed = Date.now()
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (signals.length === 0) return
    const headers = ["Ticker", "Action", "Price", "Confidence", "Status"]
    const rows = signals.map(s => [s.ticker, s.action, s.price, s.confidence, s.status])
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
    
    // Visual feedback
    console.log(">>> Exporting signals to CSV...")
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `signals_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    // Load manual signals from local storage
    const savedManual = localStorage.getItem('manual_radar_signals')
    if (savedManual) {
      try {
        const parsed = JSON.parse(savedManual) as LiveSignal[]

        // Clear tickers of loaded manual signals from the dismissed_signals blacklist
        let dismissed = JSON.parse(localStorage.getItem('dismissed_signals') || '[]') as string[]
        const manualTickers = parsed.filter(s => s && s.ticker).map(s => s.ticker)
        const newDismissed = dismissed.filter(s => !manualTickers.includes(s))
        if (newDismissed.length !== dismissed.length) {
          localStorage.setItem('dismissed_signals', JSON.stringify(newDismissed))
        }

        setSignals(prev => {
          // De-duplicate: Keep existing signals, add manual ones only if ticker present and not a duplicate
          const existingTickers = new Set(prev.filter(s => s && s.ticker).map(s => s.ticker))
          const uniqueManual = parsed.filter(s => s && s.ticker && !existingTickers.has(s.ticker))
          return [...prev, ...uniqueManual]
        })
      } catch (e) {
        console.error("Failed to load manual signals:", e)
      }
    }

    fetchDiscovery()
    // Refresh every 5 minutes
    const interval = setInterval(fetchDiscovery, 300000)
    
    // Polling is managed by MainLayout. This component just listens for changes via props.
    const handleToggleEvent = (e: any) => {
      setIsAutoPilot(e.detail)
    }
    window.addEventListener('autopilot-toggle', handleToggleEvent)

    return () => {
      clearInterval(interval)
      window.removeEventListener('autopilot-toggle', handleToggleEvent)
    }
  }, [isAutoPilot])

  const toggleGlobalAutoPilot = async () => {
    const newState = !isAutoPilot
    try {
      const res = await fetch(`/api/autopilot?enabled=${newState}`, { method: 'POST' })
      if (res.ok) {
        setIsAutoPilot(newState)
        window.dispatchEvent(new CustomEvent('autopilot-toggle', { detail: newState }))
      }
    } catch (err) {
      console.error("Failed to toggle global autopilot:", err)
    }
  }

  const filteredSignals = signals.filter(s => {
    // 1. High Confidence Filter: Allow manual signals to bypass
    if (filterHighConf && !(s as any).isManual && (s.confidence || 0) < 80) return false
    
    // Manual signals are ALWAYS visible in the radar they were added to
    if ((s as any).isManual) return true

    if (activeTab === 'live') {
      const currentStatus = s.status === 'LIVE' ? 'FILLED' : s.status
      if (isAutoPilot) {
        return currentStatus === 'FILLED'
      } else {
        // Show BOTH Pending and Filled in manual mode
        return currentStatus === 'PENDING' || currentStatus === 'FILLED'
      }
    }
    return true
  })

  const handleApprove = async (ticker: string) => {
    // Simulate approval
    setSignals(prev => prev.map(s => 
      s.ticker === ticker ? { ...s, status: 'FILLED' as const } : s
    ))
    // We could also call an API here if it existed, e.g. /api/live/execute
  }

  const handleManualOverride = () => {
    setIsModalOpen(true)
  }

  const handleManualAdd = async () => {
    if (!manualTicker) return
    const ticker = manualTicker.toUpperCase()
    
    // Fetch real-time data for the manual entry
    let price = 100.0
    let fundamental = 'B'
    try {
      const res = await fetch(`/api/signals?ticker=${ticker}`)
      if (res.ok) {
        const data = await res.json()
        price = data.current_price || 100.0
        fundamental = data.fundamental_grade || 'B'
      }
    } catch (e) {
      console.warn("Could not fetch real-time data for manual ticker:", e)
    }

    const manualSignal: LiveSignal = {
      ticker: ticker,
      company: "MANUAL OVERRIDE ENTRY",
      action: manualAction,
      size: 1.0,
      price: price,
      confidence: 100,
      time: new Date().toLocaleTimeString(),
      status: 'PENDING',
      fundamental_grade: fundamental as any,
      isManual: true // Special flag to persist and bypass filter
    } as any
    
    setSignals(prev => {
      // Avoid duplicate manual entries for the same ticker
      if (prev.some(s => s.ticker.toUpperCase() === ticker.toUpperCase())) {
        return prev
      }
      const next = [manualSignal, ...prev]
      localStorage.setItem('manual_radar_signals', JSON.stringify(next.filter(s => (s as any).isManual)))
      return next
    })
    
    setIsModalOpen(false)
    setManualTicker('')
  }

  const handleBuy = async (ticker: string) => {
    const signal = signals.find(s => s.ticker === ticker)
    if (!signal) return

    try {
      const res = await fetch('/api/live/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: signal.ticker,
          price: signal.price,
          action: signal.action,
          sl_pct: 0.05, // Default 5%
          tp_pct: 0.10, // Default 10%
          signal_id: (signal as any).signal_id // Zero Trust: Pass DB ID
        })
      })

      if (res.ok) {
        // Remove from manual list and update status
        setSignals(prev => {
          const next = prev.map(s => 
            s.ticker === ticker ? { ...s, status: 'FILLED' as any, isManual: false } : s
          )
          const manualOnly = next.filter(s => (s as any).isManual)
          localStorage.setItem('manual_radar_signals', JSON.stringify(manualOnly))
          return next
        })
        console.log(`>>> Manual BUY executed for ${ticker}`)
      } else {
        const err = await res.json()
        alert(`Failed to execute trade: ${err.detail || 'Insufficient capital'}`)
      }
    } catch (e) {
      console.error("Execution error:", e)
    }
  }

  const handleRemoveSignal = (ticker: string) => {
    if (window.confirm(`Remove ${ticker} from the pending radar?`)) {
      // 1. Add to blacklist to prevent re-appearance from scan
      const dismissed = JSON.parse(localStorage.getItem('dismissed_signals') || '[]')
      if (!dismissed.includes(ticker)) {
        localStorage.setItem('dismissed_signals', JSON.stringify([...dismissed, ticker]))
      }

      // 2. Clear from state
      setSignals(prev => {
        const next = prev.filter(s => s.ticker !== ticker)
        // Update local storage for manual signals
        const manualOnly = next.filter(s => (s as any).isManual)
        localStorage.setItem('manual_radar_signals', JSON.stringify(manualOnly))
        return next
      })
    }
  }

  const handleEmergencyClose = async (ticker: string) => {
    if (window.confirm(`DANGER: Are you sure you want to EMERGENCY CLOSE ${ticker}? This will immediately exit the position.`)) {
      try {
        const res = await fetch(`/api/portfolio/close?ticker=${ticker}`, {
          method: 'POST'
        })
        
        if (res.ok) {
          // Update the signal to CLOSED in UI
          setSignals(prev => prev.map(s => 
            s.ticker === ticker ? { ...s, status: 'CLOSED' as any } : s
          ))
          console.log(`>>> EMERGENCY CLOSE SUCCESS for ${ticker}`)
        } else {
          const err = await res.json()
          alert(`Failed to close position: ${err.detail || 'Unknown error'}`)
        }
      } catch (e) {
        console.error("Emergency close error:", e)
        alert("Failed to communicate with server for emergency close.")
      }
    }
  }

  if (isScanning && !radarError) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-[40px] border border-zinc-100 p-12 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/20 to-transparent opacity-50" />
        <div className="relative flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
          </div>
          <h3 className="text-2xl font-black text-zinc-900 mb-3 tracking-tight">Synchronizing Global Markets</h3>
          <p className="text-zinc-500 text-center max-w-sm mb-8 font-medium">
            Building live intelligence snapshot for 100+ top indices. Our AI agents are currently grading technical setups for millisecond-fast radar alerts.
          </p>
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (radarError) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-3xl border border-red-100 p-8 shadow-sm">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4 opacity-50" />
        <h3 className="text-xl font-black text-zinc-900 mb-2">System Interrupted</h3>
        <p className="text-zinc-500 mb-6 text-center max-w-sm">{radarError}</p>
        <button 
          onClick={fetchDiscovery}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100"
        >
          Re-establish Connection
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
             <Activity className="text-indigo-600 w-10 h-10" />
             AI Quant Log
          </h2>
          <p className="text-zinc-500 font-medium">Real-time filtering logic across global indices</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-zinc-100 p-1 rounded-2xl flex border border-zinc-200 shadow-inner">
            <button 
              onClick={() => setActiveTab('live')}
              className={cn("px-6 py-2 text-xs font-black transition-all rounded-xl", activeTab === 'live' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-900")}
            >
              Signal Radar
            </button>
            <button 
              onClick={() => setActiveTab('closed')}
              className={cn("px-6 py-2 text-xs font-black transition-all rounded-xl", activeTab === 'closed' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-900")}
            >
              Closed History
            </button>
          </div>

          <div className="h-8 w-px bg-zinc-200 mx-2 hidden lg:block" />

          {/* Auto-Pilot Toggle */}
          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 px-4 py-2 rounded-2xl shadow-inner">
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest leading-none">Protocol Mode</span>
                <span className={cn("text-[10px] font-black uppercase mt-0.5", isAutoPilot ? "text-emerald-600" : "text-amber-600")}>
                   {isAutoPilot ? 'Auto-Pilot' : 'Manual-Gate'}
                </span>
             </div>
             <button 
                onClick={toggleGlobalAutoPilot}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-all duration-300 ring-4 ring-white shadow-sm",
                  isAutoPilot ? "bg-emerald-500" : "bg-zinc-300"
                )}
             >
                <motion.div 
                  animate={{ x: isAutoPilot ? 24 : 0 }}
                  className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md flex items-center justify-center"
                >
                   {isAutoPilot ? <Zap className="w-2.5 h-2.5 text-emerald-500" /> : <Lock className="w-2.5 h-2.5 text-zinc-400" />}
                </motion.div>
             </button>
          </div>

          <div className="h-8 w-px bg-zinc-200 mx-2 hidden lg:block" />

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setFilterHighConf(!filterHighConf)}
              className={cn("flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black transition-all border", filterHighConf ? "bg-indigo-100 border-indigo-200 text-indigo-700 shadow-inner" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 shadow-sm")}
            >
               <Filter className="w-4 h-4" /> HIGH CONF
            </button>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2.5 rounded-2xl text-[10px] font-black text-zinc-600 hover:bg-zinc-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
            >
               <Download className="w-4 h-4" /> EXPORT
            </button>
            <button 
              onClick={handleManualOverride}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:translate-y-[-1px]"
            >
               <Plus className="w-4 h-4" /> MANUAL OVERRIDE
            </button>
          </div>
        </div>
      </header>

      {/* Summary Cards (Top of Mock 3) */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'TOTAL TRADES (24H)', value: performance.total_trades_24h.toString(), sub: `Active: ${performance.active_positions_count}`, color: 'text-indigo-600' },
          { label: 'WIN RATE', value: `${performance.win_rate}%`, progress: performance.win_rate, color: 'text-emerald-600' },
          { label: 'NET P&L', value: `${performance.net_pnl > 0 ? '+' : ''}$${performance.net_pnl.toLocaleString()}`, sub: 'Real-time Equity', color: performance.net_pnl >= 0 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'MODEL STATUS', value: 'v4.2.0 Active', dot: 'bg-emerald-500', color: 'text-zinc-900' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm flex flex-col justify-between h-32">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-end justify-between">
              <div>
                <h3 className={cn("text-2xl font-black tracking-tight", stat.color)}>{stat.value}</h3>
                {stat.sub && <p className="text-[10px] font-bold text-zinc-400 mt-1">{stat.sub}</p>}
                {stat.dot && <div className="flex items-center gap-2 mt-2">
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", stat.dot)} />
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Operational</span>
                </div>}
              </div>
              {stat.progress && (
                <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stat.progress}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Signal Table */}
      {activeTab === 'live' ? (
        <div className="bg-white rounded-[32px] border border-zinc-200 shadow-xl shadow-zinc-200/20 overflow-hidden mt-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                <th className="px-8 py-5">Symbol</th>
                <th className="px-6 py-5">Action</th>
                <th className="px-6 py-5">Size</th>
                <th className="px-6 py-5">Avg Price</th>
                <th className="px-8 py-5">Confidence</th>
                <th className="px-6 py-5">Professional Layers</th>
                <th className="px-6 py-5">Time</th>
                <th className="px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredSignals.map((signal, i) => (
                  <tr 
                    key={i} 
                    className="group hover:bg-zinc-50/50 transition-all cursor-pointer"
                    onClick={() => onTickerChange(signal.ticker)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 ring-1 ring-zinc-200 group-hover:ring-indigo-200 group-hover:bg-indigo-50 transition-all group-hover:text-indigo-600">
                          {signal.ticker?.substring(0, 2) || "??"}
                        </div>
                        <div>
                          <p className="text-sm font-black text-zinc-900 leading-none">{signal.ticker || "UNKNOWN"}</p>
                          <p className="text-[10px] text-zinc-400 font-medium mt-1">{signal.company || "Company Info N/A"}</p>
                        </div>
                      </div>
                    </td>
                  <td className="px-6 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black",
                      signal.action === 'BUY' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {signal.action === 'BUY' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {signal.action || "HOLD"}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm font-bold text-zinc-600">{(signal.size || 0).toFixed(2)}</td>
                  <td className="px-6 py-5 text-sm font-black text-zinc-900">${(signal.price || 0).toFixed(2)}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden min-w-[80px]">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${signal.confidence}%` }} />
                      </div>
                      <span className="text-[11px] font-black text-indigo-600">{signal.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                          {/* Quality Layer */}
                          {signal.fundamental_grade && (
                               <div className={cn(
                                  "flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black",
                                  signal.fundamental_grade === 'A' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                                  signal.fundamental_grade === 'B' ? "bg-blue-50 border-blue-100 text-blue-600" :
                                  "bg-zinc-50 border-zinc-100 text-zinc-400"
                                )}>
                                  <Award className="w-3 h-3" />
                                  QUAL: {signal.fundamental_grade}
                                </div>
                          )}
                          {/* Smart Money Layer */}
                          {signal.insider_score && signal.insider_score > 0.5 && (
                               <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-100 text-amber-600 rounded-lg text-[9px] font-black animate-pulse">
                                  <Briefcase className="w-3 h-3" />
                                  SMART
                               </div>
                          )}
                      </div>
                  </td>
                  <td className="px-6 py-5 text-[11px] font-bold text-zinc-400">{signal.time}</td>
                  <td className="py-4 pr-4 text-right">
                    <div className="flex justify-end items-center gap-3">
                      {/* Bought Status Badge */}
                      {signal.status === 'FILLED' && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-sm animate-in fade-in zoom-in duration-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Active Position</span>
                        </div>
                      )}

                      {/* Close Position Button (Always available for FILLED) */}
                      {signal.status === 'FILLED' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEmergencyClose(signal.ticker)
                          }}
                          className="bg-red-50 text-red-600 p-1.5 rounded-lg border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95 group relative"
                          title="Close Position"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity font-black uppercase tracking-widest">
                            CLOSE_ASSET
                          </span>
                        </button>
                      )}

                      {signal.status === 'PENDING' && (
                         <div className="flex items-center gap-2">
                           {(!isAutoPilot || (signal as any).isManual) && (
                             <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleBuy(signal.ticker)
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Buy Now</span>
                            </button>
                           )}
                          
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveSignal(signal.ticker)
                            }}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-500 p-1.5 rounded-lg border border-zinc-200 transition-all active:scale-95 shadow-sm"
                            title="Remove from Radar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                         </div>
                      )}

                      {/* Pending Badge (Only if not showing Buy button) */}
                      {(isAutoPilot || activeTab !== 'live') && signal.status === 'PENDING' && (
                        <div className={cn(
                          "inline-flex px-3 py-1 rounded-lg text-[9px] font-black tracking-tight shadow-sm",
                          "bg-zinc-100 text-zinc-500 border border-zinc-200"
                        )}>
                          {signal.status}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="px-8 py-4 bg-zinc-50/50 flex justify-between items-center text-[10px] font-bold text-zinc-500">
            <p>Showing 1-{filteredSignals.length} of {performance.total_trades_24h} trades</p>
            <div className="flex gap-2">
              <button className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">1</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-zinc-200 shadow-xl shadow-zinc-200/20 overflow-hidden mt-8">
           <div className="p-8 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                 <Clock className="w-4 h-4 text-indigo-600" />
                 Recent Session Terminations
              </h3>
              <span className="text-[10px] font-black bg-white border border-zinc-200 px-3 py-1 rounded-full text-zinc-500 uppercase">
                 ARCHIVE_v1.0
              </span>
           </div>
           {performance.trade_log && performance.trade_log.length > 0 ? (
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                   <th className="px-8 py-5">Asset</th>
                   <th className="px-6 py-5">Entry Price</th>
                   <th className="px-6 py-5">Exit Price</th>
                   <th className="px-6 py-5">Qty</th>
                   <th className="px-6 py-5">P&L (USD)</th>
                   <th className="px-8 py-5">Exit Reason</th>
                   <th className="px-6 py-5">Time</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-zinc-50">
                 {performance.trade_log.slice().reverse().map((trade: any, i: number) => (
                   <tr key={i} className="hover:bg-zinc-50/50 transition-all cursor-pointer" onClick={() => onTickerChange(trade.ticker)}>
                     <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black">
                              {trade.ticker}
                           </div>
                           <span className="text-sm font-black text-zinc-900">{trade.ticker}</span>
                        </div>
                     </td>
                     <td className="px-6 py-5 text-sm font-bold text-zinc-500">${trade.entry_price.toFixed(2)}</td>
                     <td className="px-6 py-5 text-sm font-black text-zinc-900">${trade.exit_price.toFixed(2)}</td>
                     <td className="px-6 py-5 text-sm font-bold text-zinc-600">{trade.qty}</td>
                     <td className="px-6 py-5">
                        <span className={cn(
                          "text-sm font-black px-3 py-1 rounded-full",
                          trade.pnl >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
                        )}>
                          {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}
                        </span>
                     </td>
                     <td className="px-8 py-5">
                       <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            trade.reason.includes('STOP_LOSS') ? "bg-red-500" : "bg-emerald-500"
                          )} />
                          <span className="text-[10px] font-black uppercase tracking-tight text-zinc-400">{trade.reason}</span>
                       </div>
                     </td>
                     <td className="px-6 py-5 text-[11px] font-bold text-zinc-400">
                        {new Date(trade.exit_time).toLocaleTimeString()}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           ) : (
             <div className="py-32 flex flex-col items-center justify-center text-zinc-400">
                <Activity className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-xs font-black uppercase tracking-[0.2em]">No historical data available in current session</p>
             </div>
           )}
        </div>
      )}

       {/* Manual Trade Modal */}
       <AnimatePresence>
         {isModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-white rounded-[40px] border border-zinc-200 shadow-2xl w-full max-w-md overflow-hidden"
             >
               <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 uppercase">Manual Override</h3>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">Add Ticker to Pending Radar</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-zinc-200 flex items-center justify-center transition-colors">
                    <Lock className="w-4 h-4 text-zinc-400" />
                  </button>
               </div>
               
               <div className="p-8 space-y-6">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-4">
               <ShieldAlert className="w-6 h-6 text-indigo-600 mt-1 shrink-0" />
               <div>
                  <p className="text-xs font-black text-indigo-900 uppercase tracking-tight">AI Protocol Guard Activated</p>
                  <p className="text-[11px] text-indigo-600 leading-relaxed mt-0.5">Final trade size, SL, and TP will be determined by the <b>Money Management Engine</b> at execution based on your portfolio risk settings.</p>
               </div>
            </div>

            <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-400 uppercase mb-2 block tracking-widest">Ticker Symbol</label>
                    <input 
                      type="text" 
                      value={manualTicker}
                      onChange={(e) => setManualTicker(e.target.value)}
                      placeholder="e.g. TSLA, NVDA"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 text-lg font-black text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setManualAction('BUY')}
                      className={cn(
                        "flex-1 py-4 rounded-2xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2",
                        manualAction === 'BUY' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" : "bg-zinc-50 text-zinc-400 border border-zinc-200"
                      )}
                    >
                      <ArrowUpRight className="w-4 h-4" /> BUY
                    </button>
                    <button 
                      onClick={() => setManualAction('SELL')}
                      className={cn(
                        "flex-1 py-4 rounded-2xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2",
                        manualAction === 'SELL' ? "bg-red-500 text-white shadow-lg shadow-red-100" : "bg-zinc-50 text-zinc-400 border border-zinc-200"
                      )}
                    >
                      <ArrowDownRight className="w-4 h-4" /> SELL
                    </button>
                  </div>

                  <button 
                    onClick={handleManualAdd}
                    disabled={!manualTicker}
                    className="w-full bg-indigo-600 text-white py-5 rounded-[24px] text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:translate-y-[-2px] transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                  >
                    Add to Pending Radar
                  </button>
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
    </div>
  )
}
