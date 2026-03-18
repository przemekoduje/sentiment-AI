"use client"

import React from 'react'
import { 
  Cpu, 
  MessageSquare, 
  BarChart3, 
  ShieldCheck,
  Zap,
  Play,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AIReasoningPanel() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-10">
      {/* Hero Section - The Robot Assistant (Mock 2) */}
      <div className="bg-white rounded-[40px] border-4 border-zinc-900 p-12 relative overflow-hidden shadow-[20px_20px_0px_0px_rgba(0,0,0,0.05)]">
        <div className="flex gap-12 items-center">
          <div className="w-72 h-72 rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center relative group">
             <div className="w-64 h-64 bg-zinc-200 rounded-2xl flex items-center justify-center overflow-hidden grayscale group-hover:grayscale-0 transition-all">
                {/* Robot placeholder icon */}
                <Cpu className="w-32 h-32 text-zinc-400 group-hover:text-indigo-600 transition-all" />
             </div>
             <div className="absolute top-4 right-4 bg-yellow-400 px-2 py-0.5 rounded-md text-[8px] font-black uppercase text-zinc-900 border border-zinc-900">Super Brain Edition</div>
          </div>
          
          <div className="flex-1 space-y-6">
            <h2 className="text-6xl font-black text-zinc-900 leading-[0.9] tracking-tighter">
              Meet Your <br />
              <span className="text-pink-500 underline decoration-yellow-400 decoration-4 underline-offset-8">Big-Brained</span> <br />
              Robot Assistant
            </h2>
            <p className="text-zinc-600 text-lg font-medium leading-relaxed max-w-sm">
              He's wearing a tailored suit because he's dead serious about your data (and because it was 70% off at the Digital Outlet).
            </p>
            
            <div className="flex gap-4">
               <button className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all">
                 Start Reasoning <Play className="w-4 h-4 fill-current" />
               </button>
               <button className="bg-white text-zinc-900 border border-zinc-200 px-8 py-4 rounded-2xl text-sm font-black shadow-sm flex items-center gap-2 hover:bg-zinc-50 transition-all">
                 View Logic <Eye className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Source Breakdown */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <BarChart3 className="text-white w-4 h-4" />
          </div>
          <h3 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter decoration-pink-500 decoration-4 underline underline-offset-8">Data Source Breakdown</h3>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {[
            { 
              title: 'News & Reports', 
              icon: MessageSquare, 
              color: 'bg-indigo-50 text-indigo-600', 
              desc: "What the 'serious' people with expensive ties are saying about the market. Mostly filtered for buzzwords.",
              footer: 'CONFIDENCE 88%'
            },
            { 
              title: 'Social Signals', 
              icon: Zap, 
              color: 'bg-pink-50 text-pink-600', 
              desc: "The internet's collective chaos, distilled into readable bites. We separate the signal from the screaming.",
              footer: 'SENTIMENT HIGH'
            },
            { 
              title: 'Hard Technicals', 
              icon: BarChart3, 
              color: 'bg-yellow-50 text-yellow-600', 
              desc: "Math, charts, and things that look like sharp spikes. It's science, but with better-looking gradients.",
              footer: 'STATUS: VOLATILE'
            },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-[32px] p-8 border border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-indigo-100/20 transition-all group flex flex-col h-full">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ring-4 ring-white shadow-sm", card.color)}>
                <card.icon className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-black text-zinc-900 mb-3">{card.title}</h4>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-6 flex-1">
                {card.desc}
              </p>
              <div className="pt-6 border-t border-zinc-50">
                <p className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">{card.footer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer explanation */}
      <div className="bg-indigo-50/50 rounded-[32px] p-10 border border-indigo-100 text-center space-y-4">
         <h4 className="text-xl font-black text-zinc-900">How it actually works?</h4>
         <p className="text-sm text-zinc-600 font-medium leading-loose max-w-2xl mx-auto">
           Our AI doesn't just "guess." It enters a temporary digital fugue state where it correlates 14 million data points, scans your ex's Twitter feed (not really, we have standards), and checks if Mercury is in retrograde. The result? Clean, actionable insights that make you look like the smartest person in the Zoom call.
         </p>
         <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-sm pt-4">
            <ShieldCheck className="w-5 h-5" />
            <span>Privacy Guaranteed (Robot Pinky Promise)</span>
         </div>
      </div>
    </div>
  )
}
