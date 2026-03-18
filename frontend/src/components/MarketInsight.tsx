"use client"

import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  TrendingUp, 
  Brain, 
  BarChart3, 
  Zap, 
  Clock, 
  ShieldCheck, 
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarketInsightProps {
  ticker: string
  onTickerChange: (ticker: string) => void
}

interface InsightData {
  ticker: string
  current_price: number
  signal: string
  confidence: number
  sentiment_label: string
  technical_signal: string
  technical_indicators: {
    sma5: number
    sma20: number
    sma50: number
    rsi: number
  }
  formations: string[]
  reasoning: string
  news_feed: any[]
}

export default function MarketInsight({ ticker, onTickerChange }: MarketInsightProps) {
  const [data, setData] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsight = async () => {
      setLoading(true)
      try {
        const res = await fetch(`http://localhost:8000/api/signals?ticker=${ticker}`)
        if (!res.ok) throw new Error("Failed to fetch insight")
        const result = await res.json()
        setData(result)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchInsight()
  }, [ticker])

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Decrypting Market Intelligence...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-10 rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/20">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">Live Asset</div>
             <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest leading-none">Last Sync: {new Date().toLocaleTimeString()}</span>
          </div>
          <h1 className="text-7xl font-black text-zinc-900 tracking-tighter leading-none">{data.ticker}</h1>
          <p className="text-zinc-500 font-medium text-lg italic">Hybrid Intelligence Analysis Overview</p>
        </div>

        <div className="text-right space-y-1">
          <div className="text-5xl font-black text-zinc-900">${data.current_price.toLocaleString()}</div>
          <div className={cn(
            "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase",
            data.signal === 'BUY' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
          )}>
            {data.signal === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {data.signal} SIGNAL
          </div>
        </div>
      </header>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sentiment Reasoning */}
        <div className="lg:col-span-2 bg-white rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/20 overflow-hidden">
          <div className="p-8 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
            <h3 className="text-xl font-black text-zinc-900 flex items-center gap-3">
              <Brain className="text-indigo-600 w-6 h-6" />
              AI Core Reasoning
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Conviction</span>
              <div className="w-32 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600" 
                  style={{ width: `${data.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs font-black text-indigo-600">{Math.round(data.confidence * 100)}%</span>
            </div>
          </div>
          <div className="p-10 space-y-8">
             <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-8 relative">
                <div className="absolute -top-4 -left-4 bg-white border border-indigo-100 p-3 rounded-2xl shadow-sm">
                   <MessageSquare className="text-indigo-600 w-5 h-5" />
                </div>
                <p className="text-zinc-700 text-lg font-medium leading-relaxed italic">
                  "{data.reasoning}"
                </p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                   <div className="flex items-center gap-2 text-zinc-400 mb-3">
                      <Activity className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Sentiment Pulse</span>
                   </div>
                   <div className="flex justify-between items-end">
                      <span className={cn(
                        "text-2xl font-black",
                        data.sentiment_label.includes('Bullish') ? "text-emerald-600" : "text-red-600"
                      )}>{data.sentiment_label}</span>
                      <span className="text-sm font-bold text-zinc-400 italic">Global News Aggregate</span>
                   </div>
                </div>
                <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                   <div className="flex items-center gap-2 text-zinc-400 mb-3">
                      <Zap className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Technical Signal</span>
                   </div>
                   <div className="flex justify-between items-end">
                      <span className="text-2xl font-black text-zinc-900">{data.technical_signal}</span>
                      <span className="text-sm font-bold text-zinc-400 italic">Moving Average Link</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Technical Formations Sidebar */}
        <div className="bg-zinc-900 rounded-[40px] p-10 text-white shadow-2xl shadow-indigo-900/20 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10">
              <BarChart3 className="w-32 h-32" />
           </div>
           <div className="relative z-10 space-y-8 h-full flex flex-col">
              <div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Detected Formations</h3>
                <p className="text-indigo-300 text-sm font-medium">Algorithmic Pattern Recognition</p>
              </div>

              <div className="flex-1 space-y-4">
                 {(data.formations || []).length > 0 ? (
                   data.formations.map((f, i) => (
                     <div key={i} className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/20 transition-all group">
                        <span className="text-xs font-black tracking-widest uppercase">{f.replace(/_/g, ' ')}</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                     </div>
                   ))
                 ) : (
                   <div className="text-zinc-500 italic text-sm py-10 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                      No high-conviction formations detected in the current window.
                   </div>
                 )}
              </div>

              <div className="pt-8 border-t border-white/10 grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">RSI (14)</p>
                    <p className="text-lg font-black">{data.technical_indicators?.rsi || '---'}</p>
                 </div>
                 <div className="space-y-1 text-right">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Market Status</p>
                    <p className="text-lg font-black text-emerald-400">NORMAL</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Chart & News Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* News Section */}
         <div className="bg-white rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/20 col-span-1 flex flex-col overflow-hidden">
            <div className="p-8 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-xl font-black text-zinc-900 flex items-center gap-3">
                <Clock className="text-blue-600 w-5 h-5" />
                Intelligence Feed
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[600px] p-6 space-y-4">
               {data.news_feed.map((news, idx) => (
                 <a 
                   key={idx} 
                   href={news.url} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="block p-5 rounded-3xl bg-zinc-50 hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50 transition-all border border-zinc-100 group"
                 >
                   <h4 className="font-black text-sm text-zinc-900 leading-tight group-hover:text-blue-600 transition-colors mb-2">
                     {news.title}
                   </h4>
                   <div className="flex justify-between items-center mt-3">
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{new Date(news.time_published).toLocaleDateString()}</span>
                      <div className={cn(
                        "px-2 py-0.5 rounded-md text-[8px] font-black uppercase text-white shadow-sm",
                        news.overall_sentiment_label?.includes('Bullish') ? "bg-emerald-500" : "bg-red-500"
                      )}>
                        {news.overall_sentiment_label || 'NEUTRAL'}
                      </div>
                   </div>
                 </a>
               ))}
            </div>
         </div>

         {/* Charts & Numbers */}
         <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/20 p-8 h-[450px]">
               <div className="w-full h-full rounded-2xl overflow-hidden">
                  <iframe
                    title="TradingView Chart"
                    src={`https://s.tradingview.com/widgetembed/?symbol=${ticker}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=light&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${ticker}`}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allowFullScreen={true}
                    style={{ border: 0 }}
                  />
               </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {[
                 { label: 'SMA 5', val: data.technical_indicators?.sma5 || '---' },
                 { label: 'SMA 20', val: data.technical_indicators?.sma20 || '---' },
                 { label: 'SMA 50', val: data.technical_indicators?.sma50 || '---' },
                 { label: 'RSI VALUE', val: data.technical_indicators?.rsi || '---' }
               ].map((stat, i) => (
                 <div key={i} className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-xl font-black text-zinc-900">{stat.val}</p>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  )
}
