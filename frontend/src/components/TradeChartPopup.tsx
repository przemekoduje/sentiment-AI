"use client"

import React, { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, Time, AreaSeries, LineSeries, SeriesMarker, createSeriesMarkers, IChartApi } from 'lightweight-charts'
import { X, Briefcase, Zap, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TradeChartProps {
  ticker: string
  entryTime: string
  exitTime: string
  entryPrice: number
  exitPrice: number
  stopLoss?: number
  takeProfit?: number
  backtestStart?: string
  backtestEnd?: string
  showTradeMarkers?: boolean
  onClose?: () => void
}

export default function TradeChartPopup({
  ticker,
  entryTime,
  exitTime,
  entryPrice,
  exitPrice,
  stopLoss,
  takeProfit,
  backtestStart,
  backtestEnd,
  showTradeMarkers = true,
  onClose
}: TradeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRange, setSelectedRange] = useState<string>('3M')

  const ranges = [
    { label: '1D', value: '1D' },
    { label: '5D', value: '5D' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: 'MAX', value: 'MAX' }
  ]

  useEffect(() => {
    if (!chartContainerRef.current) return

    let chartInstance: IChartApi | null = null
    let markersPlugin: any = null
    let resizeHandler: (() => void) | null = null

    const fetchChartData = async () => {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        let dynamicStart = new Date()
        
        switch (selectedRange) {
          case '1D': dynamicStart.setDate(now.getDate() - 1); break
          case '5D': dynamicStart.setDate(now.getDate() - 5); break
          case '1M': dynamicStart.setMonth(now.getMonth() - 1); break
          case '3M': dynamicStart.setMonth(now.getMonth() - 3); break
          case '6M': dynamicStart.setMonth(now.getMonth() - 6); break
          case '1Y': dynamicStart.setFullYear(now.getFullYear() - 1); break
          case 'MAX': dynamicStart.setFullYear(now.getFullYear() - 50); break
          default: dynamicStart.setMonth(now.getMonth() - 3)
        }

        let interval = "1d"
        switch (selectedRange) {
          case '1D': interval = "15m"; break
          case '5D': interval = "60m"; break
          default: interval = "1d"
        }

        const params = new URLSearchParams({
          ticker,
          entry_time: showTradeMarkers ? entryTime : dynamicStart.toISOString(),
          exit_time: showTradeMarkers ? exitTime : now.toISOString(),
          interval: interval
        })
        
        // If it's a historical trade, we might want to still allow range selection relative to trade
        // But for now, let's honor user request for "this section" (Discovery)
        if (!showTradeMarkers) {
           params.set('backtest_start', dynamicStart.toISOString())
           params.set('backtest_end', now.toISOString())
        } else {
           if (backtestStart) params.append('backtest_start', backtestStart)
           if (backtestEnd) params.append('backtest_end', backtestEnd)
        }

        const res = await fetch(`/api/chart/trade?${params.toString()}`)
        const result = await res.json()
        
        if (result.error) {
          setError(result.error)
          setLoading(false)
          return
        }

        if (!result.data || !Array.isArray(result.data)) {
          setError("No price data available for this period")
          setLoading(false)
          return
        }

        const sanitizeChartData = (raw: any[]) => {
          const seen = new Set();
          return raw
            .map(d => ({
              time: d.time as any,
              value: d.value
            }))
            .filter(d => {
              if (!d.time || seen.has(d.time)) return false;
              seen.add(d.time);
              return true;
            })
            .sort((a, b) => {
              const tA = typeof a.time === 'number' ? a.time : new Date(a.time).getTime() / 1000;
              const tB = typeof b.time === 'number' ? b.time : new Date(b.time).getTime() / 1000;
              return tA - tB;
            });
        };

        const mainData = sanitizeChartData(result.data.map((d: any) => ({
          time: d.date,
          value: d.price
        })))

        // Create Chart
        const chart = createChart(chartContainerRef.current!, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#71717a',
            fontSize: 10,
            fontFamily: 'Geist Mono',
          },
          grid: {
            vertLines: { color: '#f4f4f5' },
            horzLines: { color: '#f4f4f5' },
          },
          width: chartContainerRef.current?.clientWidth || 500,
          height: 240,
          rightPriceScale: {
            borderVisible: false,
          },
          timeScale: {
            borderVisible: false,
          },
          handleScroll: true,
          handleScale: true,
        })

        // v5 API: addSeries(AreaSeries, options)
        const areaSeries = chart.addSeries(AreaSeries, {
          lineColor: '#2563eb',
          topColor: 'rgba(37, 99, 235, 0.1)',
          bottomColor: 'rgba(37, 99, 235, 0)',
          lineWidth: 2,
        })

        areaSeries.setData(mainData)

        // Add Indicators (SMA5 / SMA20)
        const sma5Series = chart.addSeries(LineSeries, {
            color: '#8b5cf6', // Indigo/Violet
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'SMA 5'
        })
        const sma20Series = chart.addSeries(LineSeries, {
            color: '#f97316', // Orange
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'SMA 20'
        })

        const sma5Data = sanitizeChartData(result.data
            .filter((d: any) => d.sma5 !== null && d.sma5 !== undefined)
            .map((d: any) => ({ time: d.date as any, value: d.sma5 })))
        const sma20Data = sanitizeChartData(result.data
            .filter((d: any) => d.sma20 !== null && d.sma20 !== undefined)
            .map((d: any) => ({ time: d.date as any, value: d.sma20 })))

        sma5Series.setData(sma5Data)
        sma20Series.setData(sma20Data)

        // Add Markers (v5 API requires createSeriesMarkers plugin)
        const seriesMarkers = createSeriesMarkers(areaSeries)
        const markers: SeriesMarker<Time>[] = []

        // Entry Marker
        if (showTradeMarkers) {
          markers.push({
            time: entryTime.split('T')[0] as Time,
            position: 'belowBar',
            color: '#10b981',
            shape: 'arrowUp',
            text: `ENTRY @ $${entryPrice}`,
          })

          // Exit Marker
          markers.push({
            time: exitTime.split('T')[0] as Time,
            position: 'aboveBar',
            color: '#ef4444',
            shape: 'arrowDown',
            text: `EXIT @ $${exitPrice}`,
          })
        }

        // Insider Markers
        if (result.markers?.insiders && Array.isArray(result.markers.insiders)) {
          result.markers.insiders.forEach((insider: any) => {
             if (insider?.date) {
               markers.push({
                 time: insider.date as any,
                 position: 'belowBar',
                 color: '#f59e0b',
                 shape: 'circle',
                 text: `INSIDER: ${String(insider.insider || 'Anon').split(' ')[0]}`,
               })
             }
          })
        }

        // Sorting markers by time for stability
        const sortedMarkers = [...markers].sort((a, b) => {
           const valA = typeof a.time === 'number' ? a.time : new Date(a.time as string).getTime() / 1000
           const valB = typeof b.time === 'number' ? b.time : new Date(b.time as string).getTime() / 1000
           return valA - valB
        })
        
        // v5 API: call setMarkers on the plugin instance
        seriesMarkers.setMarkers(sortedMarkers)

        chart.timeScale().fitContent()

        const handleResize = () => {
          if (chartContainerRef.current) {
            chart.applyOptions({ width: chartContainerRef.current.clientWidth })
          }
        }

        window.addEventListener('resize', handleResize)
        setLoading(false)

        // Store chart for cleanup
        chartInstance = chart
        markersPlugin = seriesMarkers
        resizeHandler = handleResize

      } catch (err: any) {
        console.error("Failed to render TradingView chart:", err)
        setError(`Market Feed Interrupted: ${err.message || 'Unknown error'}`)
        setLoading(false)
      }
    }

    fetchChartData()

    return () => {
      if (resizeHandler) window.removeEventListener('resize', resizeHandler)
      if (markersPlugin) markersPlugin.detach()
      if (chartInstance) chartInstance.remove()
    }
  }, [ticker, entryTime, exitTime, backtestStart, backtestEnd, selectedRange, showTradeMarkers])

  return (
    <div className="bg-white border border-zinc-200 rounded-[32px] p-6 shadow-2xl w-full max-w-[600px] animate-in fade-in zoom-in-95 duration-200 relative pointer-events-auto text-left">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-all border border-zinc-100"
        >
          <X size={16} />
        </button>
      )}

      <div className="flex justify-between items-center mb-6 text-left">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <h4 className="text-xl font-black tracking-tight text-zinc-900">
              {ticker} <span className="font-light text-zinc-400">Analysis</span>
            </h4>
          </div>
          <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest flex items-center gap-2">
            <Zap size={10} className="text-blue-600" /> TradingView Premium Intelligence
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-zinc-50 p-1 rounded-xl border border-zinc-100 w-fit">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => setSelectedRange(r.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
              selectedRange === r.value 
                ? "bg-white text-indigo-600 shadow-sm border border-zinc-200" 
                : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div key={selectedRange} className="relative min-h-[240px] w-full bg-zinc-50/50 rounded-2xl border border-zinc-100 overflow-hidden mb-6">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
             <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
             <p className="text-[10px] text-zinc-400 font-mono uppercase">Syncing Terminal...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 p-4 text-center">
             <p className="text-xs font-bold mb-1">Interruption Detected</p>
             <p className="text-[10px] opacity-70 leading-tight">{error}</p>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-[240px]" />
      </div>

      <div className={cn("grid gap-4 text-left", showTradeMarkers ? "grid-cols-2" : "grid-cols-1")}>
        {showTradeMarkers && (
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
             <div className="flex items-center justify-between mb-2">
               <p className="text-[10px] text-zinc-500 uppercase font-black">Trade Execution</p>
               <Target size={12} className="text-emerald-500" />
             </div>
             <div className="flex justify-between items-end">
               <div>
                 <p className="text-[10px] text-zinc-400">Entry</p>
                 <p className="text-sm font-black text-emerald-600">${entryPrice.toFixed(2)}</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] text-zinc-400">Exit</p>
                 <p className="text-sm font-black text-red-600">${exitPrice.toFixed(2)}</p>
               </div>
             </div>
          </div>
        )}
        <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
           <div className="flex items-center justify-between mb-2">
             <p className="text-[10px] text-zinc-500 uppercase font-black">Smart Money Trace</p>
             <Briefcase size={12} className="text-orange-500" />
           </div>
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                 <Briefcase size={14} />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 leading-none">Status</p>
                <p className="text-[10px] font-black text-zinc-900 mt-1 uppercase">Markers Active</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
