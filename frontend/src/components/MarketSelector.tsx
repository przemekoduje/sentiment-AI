"use client"

import React, { useEffect, useState } from 'react'
import { Globe, Coins, LayoutGrid, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Market {
  id: string
  label: string
  description: string
}

interface MarketSelectorProps {
  onMarketChange?: (marketId: string) => void
}

export default function MarketSelector({ onMarketChange }: MarketSelectorProps) {
  const [markets, setMarkets] = useState<Market[]>([])
  const [activeMarket, setActiveMarket] = useState<string>('SP500')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch available markets
    fetch('/api/markets')
      .then(res => res.json())
      .then(data => setMarkets(data))
      .catch(err => console.error("Failed to fetch markets:", err))

    // Fetch current active market
    fetch('/api/markets/active')
      .then(res => res.json())
      .then(data => setActiveMarket(data.active_market))
      .catch(err => console.error("Failed to fetch active market:", err))
  }, [])

  const handleMarketSelect = async (marketId: string) => {
    if (marketId === activeMarket) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/markets/active?market=${marketId}`, {
        method: 'POST'
      })
      if (res.ok) {
        setActiveMarket(marketId)
        if (onMarketChange) onMarketChange(marketId)
      }
    } catch (error) {
      console.error("Failed to update market:", error)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (id: string) => {
    switch (id) {
      case 'CRYPTO': return <Coins className="w-4 h-4" />
      case 'NASDAQ': return <Zap className="w-4 h-4" />
      case 'POLAND': return <Globe className="w-4 h-4" />
      default: return <LayoutGrid className="w-4 h-4" />
    }
  }

  if (markets.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2 p-1 bg-zinc-100/50 rounded-2xl border border-zinc-200/50 w-fit">
      {markets.map((market) => (
        <button
          key={market.id}
          onClick={() => handleMarketSelect(market.id)}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
            activeMarket === market.id 
              ? "bg-white text-indigo-600 shadow-sm ring-1 ring-zinc-200" 
              : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
          )}
        >
          {getIcon(market.id)}
          {market.label}
        </button>
      ))}
      {loading && (
        <div className="flex items-center px-2">
            <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
