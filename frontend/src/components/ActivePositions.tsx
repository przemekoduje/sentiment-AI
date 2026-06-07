"use client"

import React from 'react'
import useSWR from 'swr'
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertTriangle,
  ChevronDown,
  Activity,
  Layers,
  Target,
  BrainCircuit
} from 'lucide-react'
import { cn } from "@/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Position {
  id: number
  ticker: string
  qty: number
  entry_price: number
  current_price: number
  roi: number
  vsa_bias: string
  sl: number
  tp: number
  entry_time: string
}

interface VSAReasoning {
  ticker: string
  quant: any
  structural: any[]
  decision: {
    recommendation: string
    reasoning: string
    trading_plan: any
  }
}

function VSAReport({ ticker }: { ticker: string }) {
  const { data, error } = useSWR<VSAReasoning>(`/api/intelligence/reasoning/${ticker}`, fetcher)

  if (error) return <div className="p-4 text-red-500 text-xs">Błąd ładowania danych VSA.</div>
  if (!data) return <div className="p-4 text-zinc-400 text-xs animate-pulse">Dekodowanie logiki VSA...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
      {/* Etap 1: Silnik Kwantyfikacji */}
      <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
        <header className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-blue-600" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">1. Mikrostruktura (Quant)</h4>
        </header>
        <div className="space-y-2">
            <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500">Rel. Volume (Effort):</span>
                <span className="font-bold text-zinc-900">{data.quant.rel_vol?.toFixed(2) || "---"}</span>
            </div>
            <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500">Rel. Spread (Result):</span>
                <span className="font-bold text-zinc-900">{data.quant.rel_spread?.toFixed(2) || "---"}</span>
            </div>
            <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500">Close Position:</span>
                <span className="font-bold text-zinc-900 uppercase">{data.quant.close_pos || "---"}</span>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-200">
                <p className="text-[9px] text-zinc-600 italic">
                    {data.quant.state_summary || "Brak anomalii wolumenowych."}
                </p>
            </div>
        </div>
      </div>

      {/* Etap 2: Walidacja Strukturalna */}
      <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
        <header className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">2. Struktura Rynku</h4>
        </header>
        <div className="space-y-2">
            <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500">Faza Wyckoffa:</span>
                <span className="font-black text-indigo-600 uppercase">
                    {data.decision.trading_plan?.market_phase || "MARKUP"}
                </span>
            </div>
            <div className="space-y-1 mt-2">
                <p className="text-[9px] font-bold text-zinc-400 uppercase">Wykryte Anomalie:</p>
                {data.structural && data.structural.length > 0 ? (
                    data.structural.map((anom, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-[9px] text-zinc-700 font-medium">
                            <span className="w-1 h-1 bg-indigo-400 rounded-full" />
                            {Array.isArray(anom.tags) ? anom.tags.join(', ') : anom.label || JSON.stringify(anom)}
                        </div>
                    ))
                ) : (
                    <p className="text-[9px] text-zinc-400">Brak krytycznych anomalii.</p>
                )}
            </div>
        </div>
      </div>

      {/* Etap 3: Logic Guard & Decision */}
      <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
        <header className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">3. Logic Guard Result</h4>
        </header>
        <div className="space-y-2">
            <div className={cn(
                "p-2 rounded-lg text-center text-[11px] font-black uppercase tracking-widest mb-2",
                data.decision.recommendation === 'BUY' ? "bg-emerald-600 text-white" :
                data.decision.recommendation === 'SELL' ? "bg-red-600 text-white" : "bg-zinc-200 text-zinc-600"
            )}>
                {data.decision.recommendation}
            </div>
            <p className="text-[10px] text-zinc-700 leading-relaxed font-medium">
                {data.decision.reasoning || "Brak szczegółowego uzasadnienia."}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-white p-1.5 rounded-md border border-zinc-200 text-center">
                    <p className="text-[8px] text-zinc-400 uppercase font-black">SL</p>
                    <p className="text-[10px] font-bold text-red-600">${data.decision.trading_plan?.sl?.toFixed(2) || "---"}</p>
                </div>
                <div className="bg-white p-1.5 rounded-md border border-zinc-200 text-center">
                    <p className="text-[8px] text-zinc-400 uppercase font-black">TP</p>
                    <p className="text-[10px] font-bold text-emerald-600">${data.decision.trading_plan?.tp?.toFixed(2) || "---"}</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

export default function ActivePositions() {
  const { data: positions, error, mutate } = useSWR<Position[]>('/api/risk/status', fetcher, {
    refreshInterval: 5000,
  })

  if (error) return <div className="text-red-500">Failed to load risk status.</div>
  if (!positions) return <div className="animate-pulse space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-16 bg-zinc-100 rounded-2xl" />
    ))}
  </div>

  return (
    <Card className="rounded-[40px] overflow-hidden border-zinc-200 shadow-xl shadow-zinc-200/20 bg-white">
      <CardHeader className="bg-zinc-50/20 border-b border-zinc-100 p-8">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-3xl font-black tracking-tighter flex items-center gap-3 text-zinc-900">
                <Target className="text-blue-600 w-8 h-8" />
                Active Risk Positions
            </CardTitle>
            <CardDescription className="font-medium text-zinc-500 mt-1 italic">Real-time VSA Monitoring & Logic Guard Verification</CardDescription>
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-white rounded-full border border-zinc-200 shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Live_Audit_Sync</span>
          </div>
        </div>
      </CardHeader>
      
      <div className="bg-zinc-50/50 border-b border-zinc-100 px-8 py-4 hidden md:grid grid-cols-12 gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 italic">
        <div className="col-span-2">Ticker</div>
        <div className="col-span-2">Entry Price</div>
        <div className="col-span-2">Current</div>
        <div className="col-span-2">ROI (%)</div>
        <div className="col-span-2">VSA Bias</div>
        <div className="col-span-2 text-right">Risk Status</div>
      </div>

      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          {positions.length === 0 ? (
              <div className="p-20 text-center text-zinc-400 font-medium italic border-b border-zinc-50">
                  <Activity className="w-8 h-8 mx-auto mb-4 opacity-10" />
                  No active positions found in current risk matrix.
              </div>
          ) : (
            positions.map((pos) => (
                <AccordionItem value={`item-${pos.id}`} key={pos.id} className="border-b border-zinc-100 last:border-0 overflow-hidden">
                  <AccordionTrigger className="hover:no-underline px-8 py-6 hover:bg-zinc-50/50 transition-all group">
                    <div className="grid grid-cols-12 gap-4 w-full items-center text-left">
                        <div className="col-span-2">
                             <span className="font-black text-2xl tracking-tighter text-zinc-900 group-hover:text-blue-600 transition-colors uppercase">
                                {pos.ticker}
                             </span>
                        </div>
                        <div className="col-span-2 font-mono text-zinc-500 text-xs">${pos.entry_price.toFixed(2)}</div>
                        <div className="col-span-2 font-mono font-bold text-zinc-900 text-sm">${pos.current_price.toFixed(2)}</div>
                        <div className="col-span-2">
                            <span className={cn(
                                "px-3 py-1 rounded-xl text-[10px] font-black border tracking-tighter",
                                pos.roi >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                            )}>
                                {pos.roi >= 0 ? '+' : ''}{pos.roi.toFixed(2)}%
                            </span>
                        </div>
                        <div className="col-span-2">
                            <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter w-fit shadow-sm",
                                pos.vsa_bias === 'BUY' ? "bg-emerald-600 text-white" :
                                pos.vsa_bias === 'SELL' ? "bg-red-600 text-white" : "bg-zinc-200 text-zinc-600"
                            )}>
                                 <BrainCircuit size={10} />
                                 {pos.vsa_bias}
                            </div>
                        </div>
                        <div className="col-span-2 flex justify-end">
                            {pos.roi < -2 ? (
                                <div className="flex items-center gap-1.5 text-red-600 px-3 py-1.5 bg-red-50 rounded-full border border-red-100 font-black text-[9px] uppercase tracking-tighter">
                                    <AlertTriangle size={12} />
                                    High Risk
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-emerald-600 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 font-black text-[9px] uppercase tracking-tighter">
                                    <ShieldCheck size={12} />
                                    Verified
                                </div>
                            )}
                        </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-zinc-50/40 border-t border-zinc-100 p-8">
                     <VSAReport ticker={pos.ticker} />
                  </AccordionContent>
                </AccordionItem>
            ))
          )}
        </Accordion>
      </CardContent>
    </Card>
  )
}
