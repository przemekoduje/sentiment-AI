"use client"

import React, { useState, useEffect } from 'react'
import { 
  Brain,
  Zap, 
  FlaskConical, 
  Briefcase, 
  Settings, 
  HelpCircle,
  BarChart2,
  Bell,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const navItems = [
  { id: 'overview', label: 'Intelligence Hub', icon: Brain },
  { id: 'discovery', label: 'Live Discovery', icon: Zap },
  { id: 'insight', label: 'Asset Analysis', icon: BarChart2 },
  { id: 'analytics', label: 'Market Metrics', icon: Activity },
  { id: 'active', label: 'Active Portfolio', icon: Briefcase },
  { id: 'alerts', label: 'Market Alerts', icon: Bell },
  { id: 'lab', label: 'Strategy Lab', icon: FlaskConical },
]

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [autoPilot, setAutoPilot] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchStatus = () => {
    fetch('http://localhost:8000/api/autopilot')
      .then(res => res.json())
      .then(data => setAutoPilot(data.enabled))
      .catch(err => console.error("Failed to fetch autopilot status:", err))
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000) // Poll every 5s to sync
    
    const handleToggleEvent = (e: any) => {
      setAutoPilot(e.detail)
    }
    window.addEventListener('autopilot-toggle', handleToggleEvent)

    return () => {
      clearInterval(interval)
      window.removeEventListener('autopilot-toggle', handleToggleEvent)
    }
  }, [])

  const toggleAutoPilot = async () => {
    setLoading(true)
    const newState = !autoPilot
    try {
      const res = await fetch(`http://localhost:8000/api/autopilot?enabled=${newState}`, {
        method: 'POST'
      })
      if (res.ok) {
        setAutoPilot(newState)
        window.dispatchEvent(new CustomEvent('autopilot-toggle', { detail: newState }))
      }
    } catch (err) {
      console.error("Failed to toggle autopilot:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="w-64 h-screen bg-white border-r border-zinc-100 flex flex-col fixed left-0 top-0 z-30 shadow-sm">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
            <Zap className="text-white w-6 h-6 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-900">Mission <span className="text-indigo-600">Control</span></h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Deep Slate Mode</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group relative",
                activeTab === item.id 
                  ? "bg-indigo-50 text-indigo-600 font-bold" 
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5",
                activeTab === item.id ? "text-indigo-600" : "text-zinc-400 group-hover:text-zinc-900"
              )} />
              <span className="text-sm">{item.label}</span>
              {activeTab === item.id && (
                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
              )}
            </button>
          ))}
        </nav>
      </div>

        <div className="px-4 py-4 rounded-3xl bg-zinc-50 border border-zinc-100 mb-4 mx-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className={cn("w-4 h-4", autoPilot ? "text-indigo-600" : "text-zinc-400")} />
              <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">Auto-Pilot</span>
            </div>
            <button 
              onClick={toggleAutoPilot}
              disabled={loading}
              className={cn(
                "w-10 h-5 rounded-full relative transition-all duration-300 focus:outline-none",
                autoPilot ? "bg-indigo-600" : "bg-zinc-300",
                loading && "opacity-50"
              )}
            >
              <div className={cn(
                "absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300",
                autoPilot ? "left-6" : "left-1"
              )} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">
            {autoPilot 
              ? "Automated execution is active. No human discretion required." 
              : "System is in Manual Mode. You must execute trades manually."}
          </p>
        </div>

      <div className="mt-auto p-6 space-y-1">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all group">
          <Settings className="w-5 h-5 text-zinc-400 group-hover:text-zinc-900" />
          <span className="text-sm">Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all group">
          <HelpCircle className="w-5 h-5 text-zinc-400 group-hover:text-zinc-900" />
          <span className="text-sm">Help & Support</span>
        </button>

        <div className="mt-6 p-4 rounded-3xl bg-indigo-600 relative overflow-hidden group cursor-pointer">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-150 transition-transform duration-500" />
          <p className="text-[10px] font-black uppercase text-indigo-100 mb-1">Live Agent</p>
          <p className="text-xs text-white leading-tight font-medium">"Sifting through 10,000 news articles..."</p>
          <div className="mt-3 w-8 h-8 rounded-full bg-indigo-500/50 flex items-center justify-center animate-pulse">
            <Zap className="w-4 h-4 text-white fill-current" />
          </div>
        </div>
      </div>
    </aside>
  )
}
