"use client"

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as LW from 'lightweight-charts'
import { 
  Eye, 
  EyeOff, 
  MousePointer2, 
  MinusSquare, 
  TrendingUp, 
  RotateCcw,
  BarChart3,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function VsaInteractiveChart({ data, anomalies = [], height = 450, ticker = "STOCK" }: any) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartInstance, setChartInstance] = useState<any>(null)
  const [seriesInstance, setSeriesInstance] = useState<any>(null)
  
  const toolModeRef = useRef<'pointer' | 'level' | 'trend'>('pointer')
  
  const [error, setError] = useState<string | null>(null)
  const [activeTool, setActiveToolState] = useState<'pointer' | 'level' | 'trend'>('pointer')
  const [engineMode, setEngineMode] = useState<'vsa' | 'tv'>('tv') 
  const [showLabels, setShowLabels] = useState(true)
  const [diag, setDiag] = useState({ signals: 0, ohlcv: 0 })

  const setActiveTool = useCallback((tool: any) => {
      toolModeRef.current = tool
      setActiveToolState(tool)
  }, [])

  // 1. Chart Initialization (VSA Mode Only)
  useEffect(() => {
    if (engineMode !== 'vsa' || !chartContainerRef.current) {
        setChartInstance(null)
        setSeriesInstance(null)
        return
    }

    try {
        const chart = LW.createChart(chartContainerRef.current, {
            layout: {
                background: { type: LW.ColorType.Solid, color: 'white' },
                textColor: '#64748b',
                fontSize: 10,
                fontFamily: 'Inter, sans-serif',
            },
            width: chartContainerRef.current.clientWidth || 800,
            height: height,
            grid: {
                vertLines: { color: '#f8fafc' },
                horzLines: { color: '#f8fafc' },
            },
            timeScale: {
                borderColor: '#cbd5e1',
                timeVisible: true,
                rightOffset: 10,
            },
            rightPriceScale: {
                borderColor: '#cbd5e1',
                autoScale: true,
            },
        })

        let series: any;
        const chartAny = chart as any;
        if (chartAny.addCandlestickSeries) {
            series = chartAny.addCandlestickSeries({
                upColor: '#10b981',
                downColor: '#ef4444',
                borderVisible: false,
                wickUpColor: '#10b981',
                wickDownColor: '#ef4444',
            })
        } else if (chartAny.addSeries) {
            series = chartAny.addSeries(LW.CandlestickSeries, {
                upColor: '#10b981',
                downColor: '#ef4444',
                borderVisible: false,
            })
        }

        if (series) {
            setChartInstance(chart)
            setSeriesInstance(series)
        }

        const observer = new ResizeObserver(entries => {
            if (entries[0] && chart) {
                chart.applyOptions({ width: entries[0].contentRect.width })
            }
        })
        observer.observe(chartContainerRef.current)

        return () => {
            observer.disconnect()
            chart.remove()
        }
    } catch (e: any) {
        setError(e.message)
    }
  }, [height, engineMode])

  // 2. Data & Marker Sync (Defensive)
  useEffect(() => {
     if (engineMode !== 'vsa' || !seriesInstance || !data || data.length === 0 || !chartInstance) return

     try {
        // 1. Candlestick Series (Price)
        let series = (chartInstance as any)._candlestickSeries
        if (!series) {
            series = chartInstance.addSeries(LW.CandlestickSeries, {
                upColor: '#10b981',
                downColor: '#ef4444',
                borderVisible: false,
                wickUpColor: '#10b981',
                wickDownColor: '#ef4444',
            })
            ;(chartInstance as any)._candlestickSeries = series
        }

        const chartData = data.map((d: any) => ({
            time: d.time,
            open: parseFloat(d.open),
            high: parseFloat(d.high),
            low: parseFloat(d.low),
            close: parseFloat(d.close),
        }))
        series.setData(chartData)

        // Volume Series (Histogram)
        let volumeSeries = (chartInstance as any)._volumeSeries
        if (!volumeSeries) {
            volumeSeries = chartInstance.addSeries(LW.HistogramSeries, {
                color: '#e2e8f0',
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            })
            chartInstance.priceScale('volume').applyOptions({
                scaleMargins: { top: 0.8, bottom: 0 },
            })
            ;(chartInstance as any)._volumeSeries = volumeSeries
        }

        // Volume SMA Series (Line)
        let volumeSMASeries = (chartInstance as any)._volumeSMASeries
        if (!volumeSMASeries) {
            volumeSMASeries = chartInstance.addSeries(LW.LineSeries, {
                color: '#6366f1',
                lineWidth: 1.5,
                priceScaleId: 'volume',
                lastValueVisible: false,
                priceLineVisible: false,
            })
            ;(chartInstance as any)._volumeSMASeries = volumeSMASeries
        }

        const volumeData = data.map((d: any) => ({
            time: d.time,
            value: parseFloat(d.volume),
            color: parseFloat(d.close) >= parseFloat(d.open) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }))
        volumeSeries.setData(volumeData)

        const smaData = data
            .filter((d: any) => d.vol_sma20 !== null && d.vol_sma20 !== undefined)
            .map((d: any) => ({
                time: d.time,
                value: parseFloat(d.vol_sma20),
            }))
        volumeSMASeries.setData(smaData)

        setDiag(prev => ({ ...prev, ohlcv: chartData.length }))

        // Enhanced Date Matching Logic
        const markers = (anomalies || []).map((a: any) => {
            const tag = a.tags?.[0] || 'VSA'
            const isSOW = ['BUYING_CLIMAX', 'UPTHRUST', 'THIN_BOOK_TRAP', 'SOW', 'NO_DEMAND', 'EFFORT_RESULT_DISSONANCE'].includes(tag)
            const shortId: any = { 
                'BUYING_CLIMAX': 'BC', 'UPTHRUST': 'UT', 'THIN_BOOK_TRAP': 'TBT', 
                'SELLING_CLIMAX': 'SC', 'SPRING': 'SP', 'SOS': 'SOS', 'SOW': 'SOW',
                'STOP_VOL_ABSORPTION': 'ST', 'EFFORT_RESULT_DISSONANCE': 'EF',
                'NO_SUPPLY': 'NS', 'NO_DEMAND': 'ND'
            }
            
            // Robust Time Matching: Handle ISO, spaces, and potential date object types
            const rawDate = a.date || ''
            const aTime = rawDate.split(' ')[0].split('T')[0].trim()
            
            return {
                time: aTime,
                position: isSOW ? 'aboveBar' : 'belowBar',
                color: isSOW ? '#f43f5e' : '#10b981',
                shape: isSOW ? 'arrowDown' : 'arrowUp',
                text: showLabels ? (shortId[tag] || tag.substring(0, 2).toUpperCase()) : '',
                size: 2, // Larger for visibility
                originalTag: tag
            }
        }).filter((m: any) => {
            // Fuzzy match: check if the string starts with/contains the date
            return chartData.some((d: any) => d.time.includes(m.time) || m.time.includes(d.time))
        })

        if (seriesInstance.setMarkers) {
            seriesInstance.setMarkers(markers.map(({ originalTag, ...rest }) => rest))
            setDiag(prev => ({ ...prev, signals: markers.length }))
        }

        // Add Crosshair Decoder for full Polish descriptions
        const handleCrosshair = (param: any) => {
            const time = param.time
            if (!time) {
                setDiag(prev => ({ ...prev, current_signal: null }))
                return
            }
            const signalAtTime = markers.find(m => m.time === time)
            if (signalAtTime) {
                const tagNames: any = {
                    'BUYING_CLIMAX': 'Buying Climax (Dystrybucja)',
                    'UPTHRUST': 'Upthrust (Pułapka na Byki)',
                    'THIN_BOOK_TRAP': 'Thin Book Trap (Cienki Arkusz)',
                    'SELLING_CLIMAX': 'Selling Climax (Kumulacja)',
                    'SPRING': 'Spring (Pułapka na Niedźwiedzie)',
                    'STOP_VOL_ABSORPTION': 'Stopping Volume (Absorpcja)',
                    'EFFORT_RESULT_DISSONANCE': 'Dysonans Wysiłek/Wynik',
                    'NO_SUPPLY': 'No Supply (Brak Podaży)',
                    'NO_DEMAND': 'No Demand (Brak Popytu)',
                    'SOS': 'Sign of Strength (Sygnał Siły)',
                    'SOW': 'Sign of Weakness (Sygnał Słabości)'
                }
                setDiag(prev => ({ ...prev, current_signal: tagNames[signalAtTime.originalTag] || signalAtTime.originalTag }))
            } else {
                setDiag(prev => ({ ...prev, current_signal: null }))
            }
        }
        chartInstance.subscribeCrosshairMove(handleCrosshair)

        // Restore Levels
        const saved = localStorage.getItem(`vsa_levels_${ticker}`)
        if (saved) {
            try {
                JSON.parse(saved).forEach((price: number) => {
                    seriesInstance.createPriceLine({ price, color: '#6366f1', lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: 'Saved' })
                })
            } catch (e) {}
        }

        chartInstance?.timeScale().fitContent()
        return () => chartInstance?.unsubscribeCrosshairMove(handleCrosshair)
     } catch (e) {
         console.error("VSA Sync Error:", e)
     }
  }, [data, anomalies, ticker, showLabels, engineMode, seriesInstance, chartInstance])

  // 3. Click Handler (Interaction Logic)
  useEffect(() => {
      if (engineMode !== 'vsa' || !chartInstance || !seriesInstance) return
      
      const handleChartClick = (param: any) => {
          if (!param.point || !seriesInstance) return
          
          const mode = toolModeRef.current
          if (mode === 'pointer') return

          // Precise Coordinate -> Price Mapping
          const price = seriesInstance.coordinateToPrice(param.point.y)
          if (price === null) return
          
          // Visual Feedback
          setDiag(prev => ({ ...prev, last_price: price.toFixed(2) }))

          if (mode === 'level') {
              seriesInstance.createPriceLine({ 
                  price: price, 
                  color: '#6366f1', 
                  lineWidth: 3, 
                  lineStyle: 1, 
                  axisLabelVisible: true, 
                  title: 'Level' 
              })
              
              const existing = localStorage.getItem(`vsa_levels_${ticker}`)
              const levels = existing ? JSON.parse(existing) : []
              levels.push(price)
              localStorage.setItem(`vsa_levels_${ticker}`, JSON.stringify(levels))
          }
          
          if (mode === 'trend') {
              seriesInstance.createPriceLine({ 
                  price: price, 
                  color: '#10b981', 
                  lineWidth: 3, 
                  lineStyle: 1, 
                  title: 'Point' 
              })
          }
      }

      chartInstance.subscribeClick(handleChartClick)
      return () => chartInstance.unsubscribeClick(handleChartClick)
  }, [ticker, engineMode, chartInstance, seriesInstance])

  const resetAll = () => {
      localStorage.removeItem(`vsa_levels_${ticker}`)
      window.location.reload()
  }

  if (error) return (
    <div className="h-[450px] bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 font-mono text-xs border border-zinc-100 rounded-[40px] p-6 text-center">
        <p className="font-black uppercase mb-2">VSA Diagnostic Node Syncing...</p>
        <button onClick={() => setEngineMode('tv')} className="mt-4 bg-zinc-900 text-white px-6 py-2 rounded-full uppercase font-black shadow-lg">Switch to Institutional Terminal (TV)</button>
    </div>
  )

  return (
    <div className="relative w-full h-[450px] bg-white rounded-[40px] border border-zinc-100 overflow-hidden flex shadow-sm group">
      {/* Sidebar - Toolbox */}
      <div className="w-16 border-r border-zinc-100 bg-zinc-50/50 flex flex-col items-center py-6 gap-6 z-20 shrink-0">
          <div className="flex flex-col gap-2">
            <ToolButton active={engineMode === 'tv'} onClick={() => setEngineMode('tv')} icon={<BarChart3 className="w-4 h-4" />} label="Institutional TV" />
            <ToolButton active={engineMode === 'vsa'} onClick={() => setEngineMode('vsa')} icon={<Zap className="w-4 h-4" />} label="VSA Diagnostic" />
          </div>
          <div className="w-8 h-px bg-zinc-200" />
          <div className="flex flex-col gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <ToolButton active={activeTool === 'pointer'} onClick={() => setActiveTool('pointer')} icon={<MousePointer2 className="w-4 h-4" />} label="Pointer" disabled={engineMode === 'tv'} />
            <ToolButton active={activeTool === 'level'} onClick={() => setActiveTool('level')} icon={<MinusSquare className="w-4 h-4" />} label="Level" disabled={engineMode === 'tv'} />
            <ToolButton active={showLabels} onClick={() => setShowLabels(!showLabels)} icon={showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} label="Toggle Labels" disabled={engineMode === 'tv'} />
            <ToolButton active={false} onClick={resetAll} icon={<RotateCcw className="w-4 h-4" />} label="Clear All" disabled={engineMode === 'tv'} />
          </div>
      </div>

      <div className="flex-1 relative h-full min-w-0">
        {/* Drawing Active Overlay */}
        {activeTool !== 'pointer' && engineMode === 'vsa' && (
            <div className="absolute inset-0 border-4 border-blue-500/20 pointer-events-none z-30 animate-pulse rounded-[38px]" />
        )}

        {/* Dual Mode Switch */}
        {engineMode === 'vsa' ? (
            <div ref={chartContainerRef} className="w-full h-full cursor-crosshair animate-in fade-in duration-500" />
        ) : (
            <div className="w-full h-full animate-in zoom-in-95 duration-500 border-l border-zinc-200">
               <iframe
                 title="Institutional Chart"
                 src={`https://s.tradingview.com/widgetembed/?symbol=${ticker}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=light&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${ticker}`}
                 width="100%"
                 height="100%"
                 frameBorder="0"
                 allowFullScreen={true}
                 className="grayscale-[0.2] contrast-[1.1]"
               />
            </div>
        )}

        {/* HUD - Always Visible */}
        <div className="absolute top-6 left-6 flex flex-col gap-3 pointer-events-none z-40 transition-transform group-hover:scale-[1.02] duration-300">
            <div className="bg-zinc-900/95 backdrop-blur-2xl px-5 py-3 rounded-3xl border border-white/10 shadow-2xl flex items-center gap-6 pointer-events-auto">
                <div className="flex flex-col min-w-[70px]">
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Engine</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{engineMode === 'tv' ? 'Institutional' : 'VSA Diagnostic'}</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col min-w-[70px]">
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Logic</span>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">{diag.signals} Signals</span>
                </div>
                { (diag as any).last_price && (
                    <>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col min-w-[70px]">
                            <span className="text-[7px] font-black text-blue-400/50 uppercase tracking-[0.2em]">Target</span>
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">{(diag as any).last_price}</span>
                        </div>
                    </>
                )}
                { (diag as any).current_signal && (
                    <>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col min-w-[120px] animate-in slide-in-from-left-2 duration-300">
                            <span className="text-[7px] font-black text-emerald-400/50 uppercase tracking-[0.2em]">VSA Signal</span>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter italic">{(diag as any).current_signal}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Drawing Feedback Bar */}
            {activeTool !== 'pointer' && engineMode === 'vsa' && (
                <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl flex items-center gap-3 shadow-xl animate-bounce pointer-events-auto border border-blue-400/30">
                    <Zap className="w-3 h-3 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Kliknij na wykres, aby dodać: {activeTool}</span>
                </div>
            )}

            {engineMode === 'tv' && (
                <div className="bg-zinc-100 text-zinc-400 px-4 py-2 rounded-2xl text-[8px] font-black uppercase tracking-widest border border-zinc-200">
                    Tryb Standardowy (Brak Edycji)
                </div>
            )}
        </div>

        <div className="absolute bottom-6 right-6 pointer-events-none opacity-20 group-hover:opacity-60 transition-opacity">
            <div className="bg-white/50 px-2 py-1 rounded text-[7px] font-black text-zinc-400 uppercase tracking-widest">
                STRATEGIC HUB V5.0
            </div>
        </div>
      </div>
    </div>
  )
}

function ToolButton({ active, onClick, icon, label, disabled = false }: any) {
    return (
        <button 
            onClick={onClick}
            title={label}
            disabled={disabled}
            className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200",
                active 
                    ? "bg-zinc-900 text-white shadow-xl shadow-zinc-200 -translate-y-0.5" 
                    : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100",
                disabled && "opacity-20 cursor-not-allowed hover:bg-transparent"
            )}
        >
            {icon}
        </button>
    )
}

