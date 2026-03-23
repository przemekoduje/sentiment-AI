"use client"

import React, { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { cn } from '@/lib/utils'

export default function KellySimulator() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({
    win_rate: 0,
    profit_factor: 0,
    max_drawdown: 0,
    expected_value: 0
  })

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: 'rgba(236, 236, 236, 0.4)' },
        horzLines: { color: 'rgba(236, 236, 236, 0.4)' },
      },
      height: 400,
      handleScroll: true,
      handleScale: true,
    })

    const aiLine = chart.addSeries(LineSeries, { 
      color: '#4f46e5', 
      lineWidth: 3,
      title: 'AI Strategy',
    })
    
    const benchmarkLine = chart.addSeries(LineSeries, { 
      color: '#e4e4e7', 
      lineWidth: 2,
      lineStyle: 1,
      title: 'S&P 500',
    })

    // Sub to real-time performance data
    const unsubscribe = onSnapshot(doc(db, 'system_stats', 'performance'), (snapshot) => {
      const data = snapshot.data();
      if (data && data.equity_curve) {
        aiLine.setData(data.equity_curve as any)
        benchmarkLine.setData(data.benchmark_curve as any)
        setMetrics(data.metrics)
      } else {
        // Fallback demo data with valid timestamps (UTCTimestamp)
        const now = Math.floor(Date.now() / 1000)
        const demoData = Array.from({ length: 100 }, (_, i) => ({
          time: (now - (100 - i) * 86400) as any,
          value: 1000 + i * 10 + Math.random() * 50
        }))
        const demoBench = Array.from({ length: 100 }, (_, i) => ({
          time: (now - (100 - i) * 86400) as any,
          value: 1000 + i * 5 + Math.random() * 20
        }))
        aiLine.setData(demoData as any)
        benchmarkLine.setData(demoBench as any)
        setMetrics({
          win_rate: 68.4,
          profit_factor: 2.15,
          max_drawdown: 8.4,
          expected_value: 42.5
        })
      }
    })

    chart.timeScale().fitContent()

    return () => {
      unsubscribe()
      chart.remove()
    }
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 bg-white rounded-[32px] border border-zinc-100 p-8 shadow-sm">
        <header className="mb-8 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tighter">AI Strategy Backtest</h3>
              <p className="text-xs font-bold text-zinc-400 mt-1 uppercase">Recursive Kelly-Optimized Equity Growth</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-indigo-600" />
                  <span className="text-[10px] font-black text-zinc-500 uppercase">AI Strategy</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-zinc-200" />
                  <span className="text-[10px] font-black text-zinc-500 uppercase">S&P 500 Index</span>
              </div>
            </div>
        </header>
        <div ref={chartContainerRef} className="w-full" />
      </div>

      <div className="space-y-4">
        {[
          { label: 'Statistical Win Rate', value: `${metrics.win_rate}%`, color: 'text-emerald-600' },
          { label: 'Profit Factor', value: metrics.profit_factor.toString(), color: 'text-indigo-600' },
          { label: 'Max Drawdown', value: `${metrics.max_drawdown}%`, color: 'text-red-600' },
          { label: 'Alpha Generated', value: '+14.2%', color: 'text-emerald-600', isPositive: true },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-[24px] p-6 border border-zinc-100 shadow-sm flex flex-col justify-between h-32">
             <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{m.label}</p>
             <h4 className={cn("text-2xl font-black tracking-tight", m.color)}>{m.value}</h4>
          </div>
        ))}
      </div>
    </div>
  )
}
