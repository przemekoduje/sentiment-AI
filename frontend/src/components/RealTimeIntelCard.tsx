"use client"

import React from 'react'
import { BarChart3, Zap, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RealTimeIntelCardProps {
    ticker: string
    onTickerChange: (ticker: string) => void
    price: number | string
    change: number
    signal: string
    sentiment: string
}

export default function RealTimeIntelCard({ 
    ticker, 
    onTickerChange, 
    price, 
    change, 
    signal,
    sentiment 
}: RealTimeIntelCardProps) {
    return (
        <div className="bg-white rounded-[40px] p-10 border border-zinc-200 shadow-sm flex flex-col justify-between relative overflow-hidden group min-h-[300px]">
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity text-zinc-900 pointer-events-none">
                <BarChart3 size={180} />
            </div>
            
            <div className="z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-4 block">Institutional Alpha Stream</span>
                <div className="flex items-center gap-6 mb-4">
                    <input 
                        type="text"
                        value={ticker}
                        onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
                        className="text-8xl font-black tracking-tighter text-zinc-900 bg-transparent border-none focus:outline-none focus:ring-0 w-64 p-0 uppercase"
                        placeholder="TICKER"
                    />
                    <div className="h-16 w-0.5 bg-zinc-100 mx-2" />
                    <div>
                        <p className="text-4xl font-medium text-zinc-400 tracking-tight">
                            ${price}
                        </p>
                        <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-tighter border",
                            change >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                        )}>
                            {change >= 0 ? "+" : ""}{change.toFixed(2)}% LIVE
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-8 z-10">
                <div className="bg-zinc-50/50 rounded-3xl p-6 border border-zinc-100 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Sentiment Bias</p>
                    <div className="flex items-end justify-between">
                        <h4 className={cn(
                            "text-3xl font-black uppercase tracking-tighter",
                            sentiment === 'positive' ? "text-emerald-600" :
                            sentiment === 'negative' ? "text-red-600" : "text-zinc-400"
                        )}>
                            {sentiment?.toUpperCase() || "NEUTRAL"}
                        </h4>
                        <Activity className="w-4 h-4 text-zinc-200 mb-1" />
                    </div>
                </div>
                <div className="bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-zinc-200 flex flex-col justify-between overflow-hidden relative">
                     <div className="absolute top-0 right-0 p-4 opacity-10">
                         <Zap className="text-white w-16 h-16" />
                     </div>
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">VSA Signal</p>
                     <h4 className="text-3xl font-black text-white uppercase tracking-tighter z-10">
                        {signal || "ANALYZING..."}
                     </h4>
                </div>
            </div>
        </div>
    )
}
