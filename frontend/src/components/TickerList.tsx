"use client"

import React, { useState, useEffect } from 'react'
import { Search, Globe, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TickerListProps {
  onTickerSelect: (ticker: string) => void
}

export default function TickerList({ onTickerSelect }: TickerListProps) {
  const [tickers, setTickers] = useState<string[]>([])
  const [market, setMarket] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const fetchTickers = async () => {
    try {
      const res = await fetch('/api/markets/tickers')
      const data = await res.json()
      setTickers(data.tickers || [])
      setMarket(data.market || "")
      setLoading(false)
    } catch (error) {
      console.error("Failed to fetch tickers:", error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickers()
    // Poll every 5s to stay in sync with market changes
    const interval = setInterval(fetchTickers, 5000)
    return () => clearInterval(interval)
  }, [])

  const filteredTickers = tickers.filter(t => 
    t.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 100) // Limit to 100 for performance

  return (
    <div className="flex flex-col h-full bg-zinc-50/50 rounded-3xl border border-zinc-100 overflow-hidden">
      <div className="p-4 border-b border-zinc-100 bg-white">
        <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Available in {market}</h4>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{tickers.length}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input 
            type="text"
            placeholder="Search market..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-100 border-none rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {filteredTickers.map(ticker => (
              <button
                key={ticker}
                onClick={() => onTickerSelect(ticker)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white hover:shadow-sm hover:border-zinc-200 border border-transparent transition-all group"
              >
                <span className="text-[11px] font-black text-zinc-700 group-hover:text-indigo-600">{ticker}</span>
                <ChevronRight className="w-3 h-3 text-zinc-300 group-hover:text-indigo-400 translate-x-1 opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            ))}
          </div>
        )}
        {!loading && filteredTickers.length === 0 && (
          <p className="text-[10px] text-center text-zinc-400 py-4 font-bold uppercase">No assets found</p>
        )}
      </div>

      <div className="p-3 bg-white border-t border-zinc-100">
          <p className="text-[9px] text-zinc-400 font-bold leading-tight">
            Showing {filteredTickers.length} of {tickers.length} assets. Use search for deep reach.
          </p>
      </div>
    </div>
  )
}
