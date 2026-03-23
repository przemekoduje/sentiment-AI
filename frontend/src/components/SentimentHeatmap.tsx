"use client"

import React, { useEffect, useState } from 'react'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, limit } from 'firebase/firestore'
import { cn } from '@/lib/utils'
import { Activity, ShieldCheck, ShieldAlert, Clock, Info } from 'lucide-react'

interface MarketNode {
  name: string
  ticker: string
  price: number
  change_pct: number
  sentiment_score: number
  size: number
  weight: number
  [key: string]: any
}

interface SentimentHeatmapProps {
  onTickerSelect: (ticker: string) => void
}

const CustomContent = (props: any) => {
  const { x, y, width, height, ticker, change_pct = 0 } = props
  if (width < 10 || height < 10) return null

  const isPositive = Number(change_pct) >= 0
  const color = isPositive ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)'

  return (
    <g onClick={() => props.onTickerSelect(ticker)} style={{ cursor: 'pointer' }}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#fff',
          strokeWidth: 1.5,
        }}
        className="hover:opacity-80 transition-opacity"
      />
      {width > 28 && height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={Math.min(width / 4, 11)}
          fontWeight="900"
          className="pointer-events-none select-none font-sans"
        >
          {ticker}
        </text>
      )}
    </g>
  )
}

export default function SentimentHeatmap({ onTickerSelect }: SentimentHeatmapProps) {
  const [data, setData] = useState<MarketNode[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'connected' | 'error' | 'syncing'>('syncing')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'sp500_heatmap'), limit(500))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deduplicated = new Map<string, MarketNode>()
      
      snapshot.docs.forEach(doc => {
        const d = doc.data()
        if (!d.ticker) return
        
        const rawSize = d.size && d.size > 0 ? d.size : (Math.abs(d.change_pct || 0) + 1)
        const nodeWeight = Math.log10(Math.max(rawSize, 100)) * 10
        
        deduplicated.set(d.ticker, {
          name: d.ticker,
          ticker: d.ticker,
          price: Number(d.price) || 0,
          change_pct: Number(d.change_pct) || 0,
          sentiment_score: Number(d.sentiment) || 0,
          size: rawSize,
          weight: isNaN(nodeWeight) ? 1 : nodeWeight
        })
      })

      const nodes = Array.from(deduplicated.values())
      setData(nodes.sort((a, b) => b.weight - a.weight))
      setLoading(false)
      setStatus('connected')
      setLastUpdate(new Date())
    }, (error) => {
      console.error(">>> [Heatmap] Connection Fault:", error)
      setStatus('error')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return (
    <div className="bg-white rounded-[32px] border border-zinc-100 p-8 shadow-sm h-full flex flex-col min-h-[650px] relative overflow-hidden group">
      <div className="absolute top-8 right-8 flex items-center gap-4 z-10">
         {lastUpdate && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 rounded-xl border border-zinc-100/50">
               <Clock className="w-3 h-3 text-zinc-400" />
               <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                  Updated: {lastUpdate.toLocaleTimeString()}
               </span>
            </div>
         )}
         <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500",
            status === 'connected' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
            status === 'error' ? "bg-red-50 border-red-100 text-red-600" :
            "bg-zinc-50 border-zinc-100 text-zinc-400"
         )}>
            <div className={cn(
               "w-1.5 h-1.5 rounded-full",
               status === 'connected' ? "bg-emerald-500 animate-pulse" :
               status === 'error' ? "bg-red-500" : "bg-zinc-300 animate-bounce"
            )} />
            <span className="text-[9px] font-black uppercase tracking-widest leading-none">
               {status === 'connected' ? "Bridge: Active" : 
                status === 'error' ? "Bridge: Fault" : "Warming Pulse"}
            </span>
         </div>
      </div>

      <div className="mb-8">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-900 rounded-3xl flex items-center justify-center shadow-2xl shadow-zinc-200">
               <Activity className="text-white w-6 h-6" />
            </div>
            <div>
               <h3 className="text-xl font-black text-zinc-900 uppercase leading-none tracking-tight">Sentiment Flux Map</h3>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3 text-indigo-500" />
                  S&P 500 Market Intelligence Layer
               </p>
            </div>
         </div>
      </div>
      
      {/* 
          CRITICAL: Providing a concrete height to ResponsiveContainer 
          to prevent dimensions collapse (-1x-1) in flex layouts.
      */}
      <div className={cn(
        "flex-1 bg-zinc-100/30 rounded-[32px] overflow-hidden border border-zinc-100 relative transition-all duration-500 min-h-[500px]",
        loading ? "opacity-30 blur-sm" : "opacity-100"
      )}>
        {loading && (
           <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin mb-4" />
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Calibrating Nodes</p>
           </div>
        )}

        {data.length === 0 && !loading && (
           <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-12 text-center">
              <ShieldAlert className="w-10 h-10 text-zinc-200 mb-6" />
              <p className="font-black uppercase tracking-widest text-[11px] text-zinc-900">Zero-Point Detected</p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-4 leading-relaxed max-w-xs">
                 Market engines are preparing the S&P 500 footprint. Stand by.
              </p>
           </div>
        )}

        <ResponsiveContainer width="100%" height={500}>
          <Treemap
            data={data}
            dataKey="weight"
            nameKey="ticker"
            stroke="#fff"
            content={<CustomContent onTickerSelect={onTickerSelect} />}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload
                  return (
                    <div className="bg-white p-6 rounded-[24px] shadow-2xl border border-zinc-100 backdrop-blur-3xl bg-white/95 ring-1 ring-zinc-100">
                      <div className="flex items-center justify-between gap-8 mb-4">
                        <p className="text-sm font-black text-zinc-900">{d.ticker}</p>
                        <div className="px-2 py-0.5 bg-zinc-50 rounded-md border border-zinc-100">
                           <span className="text-[8px] font-black text-zinc-500 uppercase">S&P 500</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-6">
                           <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">Quote</span>
                           <span className="text-xs font-black text-zinc-900">${(d.price || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-6">
                           <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">24H Flux</span>
                           <span className={cn(
                             "text-xs font-black",
                             (d.change_pct || 0) >= 0 ? "text-emerald-600" : "text-red-500"
                           )}>
                             {(d.change_pct || 0) >= 0 ? '+' : ''}{(d.change_pct || 0).toFixed(2)}%
                           </span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 flex items-center justify-between">
         <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
               <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200" />
               <span className="text-[10px] font-black uppercase text-zinc-500 tracking-tight">Bullish Intelligence</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-lg shadow-red-200" />
               <span className="text-[10px) font-black uppercase text-zinc-500 tracking-tight">Bearish Pressure</span>
            </div>
         </div>
         <div className="flex items-center gap-2 group/info cursor-help">
            <Info className="w-3.5 h-3.5 text-zinc-300 transition-colors group-hover/info:text-indigo-400" />
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
               Coverage: {data.length} Nodes
            </p>
         </div>
      </div>
    </div>
  )
}
