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
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
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
