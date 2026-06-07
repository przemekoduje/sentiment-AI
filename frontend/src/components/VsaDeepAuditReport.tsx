"use client"

import React from 'react'
import { Brain, Search, Layout, Target, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import VsaInteractiveChart from './VsaInteractiveChart'
import VsaChatModule from './VsaChatModule'
import VSAMarkdown from './VSAMarkdown'

interface VsaDeepAuditReportProps {
    ticker: string
    analysisText: string
    ohlcv?: any[]
    anomalies?: any[]
    loading: boolean
}

export default function VsaDeepAuditReport({ ticker, analysisText, ohlcv, anomalies, loading }: VsaDeepAuditReportProps) {
    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="bg-white rounded-[40px] border border-zinc-100 h-[450px] w-full" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-[32px] border border-zinc-100 p-8 h-48" />
                ))}
            </div>
        )
    }

    if (!analysisText) {
        return (
            <div className="bg-white rounded-[32px] border border-zinc-100 p-12 text-center">
                <p className="text-zinc-400 font-medium">Brak danych do analizy. Wybierz spółkę powyżej.</p>
            </div>
        )
    }

    // Heuristically split by "ETAP \d+:" (case-insensitive)
    const sections = analysisText.split(/ETAP \d+:/gi).filter(s => s.trim().length > 0);
    const stageTitles = [
        "Analiza Ilościowa (Kwantyfikacja Mikrostruktury)",
        "Model Wizualno-Strukturalny (VSA & Wyckoff)",
        "Wyniki, Uzasadnienie i Plan Działania"
    ];

    const icons = [
        <Search className="w-5 h-5 text-blue-600" />,
        <Layout className="w-5 h-5 text-indigo-600" />,
        <Target className="w-5 h-5 text-emerald-600" />
    ];

    return (
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-start pb-20">
            {/* Left Column: Sticky Interactive Chart */}
            <div className="lg:sticky lg:top-8 order-2 lg:order-1">
                <div className="bg-white rounded-[40px] border border-zinc-200 p-2 shadow-sm overflow-hidden group">
                    <div className="relative bg-zinc-50 rounded-[38px] overflow-hidden border border-zinc-100/50 min-h-[450px]">
                        <VsaInteractiveChart 
                            key={ohlcv?.[0]?.time || 'vsa-chart'}
                            ticker={ticker}
                            data={ohlcv || []} 
                            anomalies={anomalies || []}
                        />
                    </div>
                </div>
                
                {/* Micro-Intel or Summary can go here if needed later */}
                <div className="mt-8 px-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-none">
                            Institutional Evidence Layer (v3.1)
                        </span>
                    </div>
                </div>

                {/* Conversational VSA Intelligence */}
                <VsaChatModule ticker={ticker} />
            </div>

            {/* Right Column: Scrollable Analysis Sections */}
            <div className="space-y-8 order-1 lg:order-2">
                {sections.map((content, idx) => (
                    <div key={idx} className="bg-white rounded-[40px] border border-zinc-200 p-10 shadow-sm relative group transition-all hover:shadow-xl hover:shadow-zinc-200/40">
                        <div className="absolute top-0 right-0 p-8 opacity-5 text-zinc-900 pointer-events-none group-hover:opacity-10 transition-all">
                            {icons[idx]}
                        </div>
                        
                        <header className="flex items-center gap-4 mb-8">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 text-white text-[10px] font-black italic">
                                0{idx + 1}
                            </div>
                            <h3 className="text-xl font-black text-zinc-900 tracking-tight uppercase">
                                {stageTitles[idx]}
                            </h3>
                        </header>

                        <div className="prose prose-zinc max-w-none">
                            <VSAMarkdown className="text-zinc-600 leading-relaxed font-medium text-sm">
                                {content.trim()}
                            </VSAMarkdown>
                        </div>

                        {idx === 2 && (
                            <div className="mt-10 pt-8 border-t border-zinc-100 flex items-center justify-between">
                                <button className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 tracking-widest group-hover:gap-3 transition-all">
                                    Open Full Strategy Lab <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
