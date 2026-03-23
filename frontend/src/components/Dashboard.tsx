"use client"

import React, { useState } from 'react'
import { 
  LayoutDashboard, 
  Target, 
  Map, 
  Activity, 
  Zap,
  TrendingUp,
  Brain,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'

// Lazy-loaded visual components
import MissionControlView from './MissionControlView'
import SentimentHeatmap from './SentimentHeatmap'
import KellySimulator from './KellySimulator'

export default function Dashboard() {
  const [ticker, setTicker] = useState('AAPL')

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-100 px-8 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-8">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <Brain className="text-white w-6 h-6" />
             </div>
             <div>
                <h1 className="text-xl font-black tracking-tighter uppercase leading-none">Sentiment AI</h1>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Hybrid Intelligence Terminal v2.0</p>
             </div>
          </div>

          <div className="flex-1 max-w-md relative group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" />
             <input 
               type="text" 
               placeholder="Search Ticker (e.g. NVDA, BTC-USD)..."
               value={ticker}
               onChange={(e) => setTicker(e.target.value.toUpperCase())}
               className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
             />
          </div>

          <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">System Status</span>
                <div className="flex items-center gap-2 mt-1">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-xs font-black text-emerald-600 uppercase">Live Pulse Active</span>
                </div>
             </div>
             <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200" />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8 bg-[#FDFDFD]">
        <Tabs defaultValue="mission-control" className="space-y-8">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="bg-zinc-100/50 p-1.5 rounded-2xl border border-zinc-100">
              <TabsTrigger value="mission-control" className="gap-2">
                <Target className="w-4 h-4" />
                Mission Control
              </TabsTrigger>
              <TabsTrigger value="heatmap" className="gap-2">
                <Map className="w-4 h-4" />
                S&P 500 Heatmap
              </TabsTrigger>
              <TabsTrigger value="simulator" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Kelly Simulator
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-3">
               <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3 h-3 fill-indigo-600" />
                    Fast-Path Enabled
                  </span>
               </div>
            </div>
          </div>

          <TabsContent value="mission-control" className="mt-0 focus-visible:ring-0">
             <MissionControlView ticker={ticker} />
          </TabsContent>

          <TabsContent value="heatmap" className="mt-0 focus-visible:ring-0">
             <SentimentHeatmap onTickerSelect={setTicker} />
          </TabsContent>

          <TabsContent value="simulator" className="mt-0 focus-visible:ring-0">
             <KellySimulator />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
