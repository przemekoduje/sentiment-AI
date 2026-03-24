"use client"

import React, { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MissionControl from './MissionControl'
import StrategyLab from './StrategyLab'
import DiscoveryRadar from './DiscoveryRadar'
import AIReasoningPanel from './AIReasoningPanel'
import LiveDecisionMatrix from './LiveDecisionMatrix'
import MarketInsight from './MarketInsight'
import Portfolio from './Portfolio'
import Alerts from './Alerts'

import AlphaIntelligenceHub from './AlphaIntelligenceHub'

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState('overview')
  const [activeTicker, setActiveTicker] = useState('AAPL')
  const [filterHighConf, setFilterHighConf] = useState(false)
  const [isAutoPilot, setIsAutoPilot] = useState(true)
  const [isAutoPilotLoading, setIsAutoPilotLoading] = useState(false)
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('online')

  // Sync Auto-Pilot with backend
  React.useEffect(() => {
    const fetchStatus = async () => {
      // Circuit Breaker: Stop noise if server is offline
      if (serverStatus === 'offline') {
        const timeout = setTimeout(() => setServerStatus('online'), 15000)
        return () => clearTimeout(timeout)
      }

      try {
        const res = await fetch('/api/autopilot')
        if (!res.ok) {
           setServerStatus('offline')
           return
        }
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          setServerStatus('online')
          if (data.enabled !== isAutoPilot && !isAutoPilotLoading) {
            setIsAutoPilot(data.enabled)
          }
        } catch (jsonErr) {
          console.warn("Autopilot sync: Received non-JSON response.")
          setServerStatus('offline')
        }
      } catch (err) {
        setServerStatus('offline')
      }
    }
    
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000) // Increase to 10s for stability
    return () => clearInterval(interval)
  }, [isAutoPilot, isAutoPilotLoading, serverStatus])

  const toggleAutoPilot = async () => {
    setIsAutoPilotLoading(true)
    const newState = !isAutoPilot
    try {
      const res = await fetch(`/api/autopilot?enabled=${newState}`, {
        method: 'POST'
      })
      if (res.ok) {
        setIsAutoPilot(newState)
      }
    } catch (err) {
      console.error("Failed to toggle autopilot:", err)
    } finally {
      setIsAutoPilotLoading(false)
    }
  }

  const handleSearch = (ticker: string) => {
    setActiveTicker(ticker)
    setActiveTab('overview')
  }

  const handleNavigateToInsight = (ticker: string) => {
    setActiveTicker(ticker)
    setActiveTab('insight')
  }

  return (
    <div className="flex bg-[#FDFDFD] min-h-screen font-sans text-zinc-900">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isAutoPilot={isAutoPilot}
        onAutoPilotToggle={toggleAutoPilot}
        isAutoPilotLoading={isAutoPilotLoading}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col">
        <TopBar onSearch={handleSearch} />
        
        <main className="p-8">
          {activeTab === 'overview' && (
            <AlphaIntelligenceHub 
              ticker={activeTicker} 
              onTickerSelect={setActiveTicker} 
            />
          )}
          
           {activeTab === 'discovery' && (
            <div className="max-w-6xl mx-auto space-y-12">
              <DiscoveryRadar 
                onTickerChange={handleNavigateToInsight} 
                filterHighConf={filterHighConf}
                setFilterHighConf={setFilterHighConf}
                isAutoPilot={isAutoPilot}
                setIsAutoPilot={setIsAutoPilot}
              />
              <LiveDecisionMatrix 
                filterHighConf={filterHighConf}
              />
            </div>
          )}

          {activeTab === 'insight' && (
            <MarketInsight ticker={activeTicker} onTickerChange={handleNavigateToInsight} />
          )}

          {activeTab === 'analytics' && (
            <AIReasoningPanel />
          )}
          
          {activeTab === 'lab' && (
            <div className="max-w-6xl mx-auto">
               <div className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm">
                  <header className="mb-8">
                    <h2 className="text-3xl font-black tracking-tight text-zinc-900">Strategy Lab</h2>
                    <p className="text-zinc-500 font-medium">Historical Simulations & Backtesting Engine</p>
                  </header>
                  <StrategyLab ticker={activeTicker} onTickerChange={setActiveTicker} />
               </div>
            </div>
          )}

          {activeTab === 'active' && (
            <Portfolio />
          )}

          {activeTab === 'alerts' && (
            <Alerts onTickerNavigate={handleNavigateToInsight} />
          )}
        </main>
      </div>
    </div>
  )
}
