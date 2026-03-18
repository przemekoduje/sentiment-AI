"use client"

import React from 'react'
import { 
  Search, 
  Settings, 
  Bell, 
  User as UserIcon,
  ChevronDown
} from 'lucide-react'

interface TopBarProps {
  onSearch?: (ticker: string) => void
}

export default function TopBar({ onSearch }: TopBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(e.currentTarget.value.toUpperCase())
    }
  }

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex-1 max-w-xl relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" />
        <input 
          type="text" 
          placeholder="Search markets, signals, news..."
          onKeyDown={handleKeyDown}
          className="w-full bg-zinc-100/50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100 mr-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Status: Live</span>
        </div>

        <button className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
          Launch Strategy
        </button>

        <div className="flex items-center gap-2 ml-4">
          <button className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition-all relative">
            <Bell className="w-5 h-5" />
            <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
          </button>
          
          <button className="flex items-center gap-2 p-1 pr-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 transition-all group">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs ring-2 ring-white">
              PR
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-zinc-900 leading-none">Przemysław</p>
              <p className="text-[9px] text-zinc-500 font-medium">Pro Trader</p>
            </div>
          </button>
        </div>
      </div>
    </header>
  )
}
