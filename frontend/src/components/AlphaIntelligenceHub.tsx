"use client"

import React from 'react'
import { 
  Target, 
  Map, 
  TrendingUp,
  Zap
} from 'lucide-react'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'

// Lazy-loaded visual components from the new architecture
import MissionControlView from './MissionControlView'
import SentimentHeatmap from './SentimentHeatmap'
import KellySimulator from './KellySimulator'

interface AlphaIntelligenceHubProps {
  ticker: string
  onTickerSelect: (ticker: string) => void
}

export default function AlphaIntelligenceHub({ ticker, onTickerSelect }: AlphaIntelligenceHubProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 min-h-[600px]">
        <div className="h-12 bg-zinc-100/50 rounded-2xl border border-zinc-100 animate-pulse w-96 mb-8" />
        <div className="bg-white rounded-[32px] border border-zinc-100 p-12 min-h-[400px] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
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
           <SentimentHeatmap onTickerSelect={onTickerSelect} />
        </TabsContent>

        <TabsContent value="simulator" className="mt-0 focus-visible:ring-0">
           <KellySimulator />
        </TabsContent>
      </Tabs>
    </div>
  )
}
