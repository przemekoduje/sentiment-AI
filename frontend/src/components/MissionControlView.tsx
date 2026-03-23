"use client"

import React, { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { 
  TrendingUp, 
  AlertCircle, 
  Activity, 
  Zap,
  RefreshCw,
  Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MissionControlViewProps {
  ticker: string
}

export default function MissionControlView({ ticker }: MissionControlViewProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsubscribe = onSnapshot(doc(db, 'analysis_snapshots', ticker), (snapshot) => {
      if (snapshot.exists()) {
        setData(snapshot.data())
      } else {
        setData(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [ticker])

  if (loading && !data) {
     return (
        <div className="bg-white rounded-[32px] border border-zinc-100 p-12 flex flex-col items-center justify-center min-h-[400px] animate-pulse">
           <RefreshCw className="w-12 h-12 text-zinc-200 animate-spin mb-4" />
           <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Gathering Live Intel for {ticker}...</p>
        </div>
     )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-[32px] border border-zinc-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-6">
           <AlertCircle className="w-8 h-8 text-zinc-400" />
        </div>
        <h3 className="text-xl font-black text-zinc-900 uppercase">Snapshot Unavailable</h3>
        <p className="text-sm text-zinc-500 text-center max-w-sm mt-3 font-medium">
          The ticker <span className="text-indigo-600 font-bold">{ticker}</span> has not been processed by the AI Engine yet. The next scan cycle will generate this record.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95"
        >
          Force Manual Scan
        </button>
      </div>
    )
  }

  const sentiment = data.sentiment_score ?? 0
  const isPositive = sentiment > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Big Alpha Card */}
      <div className="lg:col-span-2 bg-white rounded-[40px] border border-zinc-100 p-12 shadow-sm relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <TrendingUp size={160} />
         </div>

         <div className="relative z-10">
            <header className="flex justify-between items-start mb-12">
               <div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 block">Real-time Intelligence</span>
                  <h2 className="text-7xl font-black tracking-tighter text-zinc-900">{ticker}</h2>
                  <div className="flex items-center gap-4 mt-4">
                     <span className="text-3xl font-medium text-zinc-400">$ {data.current_price?.toFixed(2) || '---'}</span>
                     <div className={cn(
                       "px-2 py-1 rounded-lg border text-[10px] font-black",
                       isPositive ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-red-50 border-red-100 text-red-600"
                     )}>
                       {isPositive ? '+' : ''}{((data.sentiment_score || 0) * 100).toFixed(1)}% CONFIDENCE
                     </div>
                  </div>
               </div>
               
               <div className="text-right">
                  <div className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-2xl border mb-2",
                    data.signal === 'BUY' ? "bg-emerald-600 text-white border-emerald-500 shadow-xl shadow-emerald-100" : "bg-red-600 text-white border-red-500 shadow-xl shadow-red-100"
                  )}>
                     <Zap className="w-4 h-4 fill-white" />
                     <span className="text-xs font-black uppercase tracking-widest">{data.signal}</span>
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">AI Signal Recommendation</p>
               </div>
            </header>

            <div className="grid grid-cols-2 gap-6 mt-12">
               <div className="bg-zinc-50 rounded-3xl p-6 border border-zinc-100 flex flex-col justify-between h-32">
                  <div className="flex justify-between items-start">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sentiment Pulse</span>
                     <Activity className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className={cn("text-2xl font-black", isPositive ? "text-emerald-600" : "text-red-600")}>
                      {data.sentiment_label?.toUpperCase() || 'NEUTRAL'}
                    </h4>
                    <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase">GPT-4o Evaluation</p>
                  </div>
               </div>
               <div className="bg-zinc-50 rounded-3xl p-6 border border-zinc-100 flex flex-col justify-between h-32">
                  <div className="flex justify-between items-start">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Money Management</span>
                     <TrendingUp className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-zinc-900">
                      {((data.round_kelly || 0) * 100).toFixed(2)}%
                    </h4>
                    <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase">Optimal Kelly Fraction</p>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Reasoning & News Feed */}
      <div className="space-y-6">
         {/* Reasoning Card */}
         <div className="bg-white rounded-[32px] border border-zinc-100 p-8 shadow-sm flex flex-col overflow-hidden h-[240px]">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
               <Brain className="w-4 h-4 text-indigo-600" />
               Logic Decomposition
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
               <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                  <p className="text-xs text-indigo-900 font-medium leading-relaxed italic">
                    "{data.reasoning || "Analyzing market structure and news flow..."}"
                  </p>
               </div>
               <div className="px-3 py-1.5 bg-zinc-100 rounded-xl text-[10px] font-bold text-zinc-600 border border-zinc-200 uppercase w-fit">
                  {data.technical_signal || 'NEUTRAL'}
               </div>
            </div>
         </div>

         {/* News Intel Card */}
         <div className="bg-white rounded-[32px] border border-zinc-100 p-8 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[300px]">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
               <RefreshCw className="w-4 h-4 text-indigo-600" />
               News Intelligence
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
               {data.news_feed && data.news_feed.length > 0 ? (
                  data.news_feed.map((item: any, idx: number) => (
                     <a 
                        key={idx} 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100/50 transition-all border border-zinc-100 group"
                     >
                        <h4 className="text-[11px] font-black text-zinc-900 group-hover:text-indigo-600 line-clamp-2 leading-tight">
                           {item.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-[9px] font-bold text-zinc-400 uppercase">
                              {new Date(item.time_published).toLocaleDateString()}
                           </span>
                           {item.source && (
                              <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-1 rounded">
                                 {item.source.toUpperCase()}
                              </span>
                           )}
                        </div>
                     </a>
                  ))
               ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-400 opacity-50">
                     <AlertCircle className="w-8 h-8 mb-2" />
                     <p className="text-[10px] font-bold uppercase">No news synced</p>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  )
}
