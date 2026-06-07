"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Send, User, Bot, Loader2, MessageSquare, Sparkles, ChevronRight, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import VSAMarkdown from './VSAMarkdown'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

interface VsaChatModuleProps {
    ticker: string
}

const QUICK_PROMPTS = [
    { label: "Analiza Wolumenu", icon: <Hash className="w-3 h-3" /> },
    { label: "Czy to Upthrust?", icon: <Sparkles className="w-3 h-3" /> },
    { label: "Gdzie jest SL?", icon: <ChevronRight className="w-3 h-3" /> }
]

export default function VsaChatModule({ ticker }: VsaChatModuleProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, loading, streamingContent])

    const handleSend = async (overrideInput?: string) => {
        const messageToSend = overrideInput || input
        if (!messageToSend.trim() || loading) return

        const userMsg: Message = { role: 'user', content: messageToSend }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setLoading(true)
        setStreamingContent('')

        try {
            const response = await fetch('/api/intelligence/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker,
                    message: messageToSend,
                    history: messages
                })
            })

            if (!response.ok) throw new Error('Network response was not ok')

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let accumulatedContent = ''

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\n')
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6)
                            if (dataStr === '[DONE]') {
                                // Finalize the message
                                setMessages(prev => [...prev, { role: 'assistant', content: accumulatedContent }])
                                setStreamingContent('')
                                break
                            }
                            try {
                                const data = JSON.parse(dataStr)
                                if (data.content) {
                                    accumulatedContent += data.content
                                    setStreamingContent(accumulatedContent)
                                } else if (data.error) {
                                    setMessages(prev => [...prev, { role: 'assistant', content: `Błąd: ${data.error}` }])
                                }
                            } catch (e) {
                                // Silent fail for malformed chunks
                            }
                        }
                    }
                }
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Błąd połączenia z serwerem inteligencji." }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mt-8 backdrop-blur-xl bg-white/70 rounded-[32px] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[600px] border-zinc-200/50">
            {/* Header */}
            <header className="px-6 py-5 border-b border-white/50 bg-white/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-zinc-900 p-2 rounded-xl shadow-lg shadow-zinc-900/20">
                        <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">VSA Intelligence</h4>
                        <p className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                            <Sparkles className="w-2 h-2" /> Contextual Awareness Active
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">VSA Bible v3</span>
                </div>
            </header>

            {/* Chat Body */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[300px] scroll-smooth"
            >
                <AnimatePresence initial={false}>
                    {messages.length === 0 && !streamingContent && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="h-full flex flex-col items-center justify-center text-center space-y-5 py-12"
                        >
                            <div className="p-5 bg-white/50 rounded-full border border-white shadow-inner">
                                <Bot className="w-10 h-10 text-zinc-300" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                                    Strategic Analysis Ready
                                </p>
                                <p className="text-[9px] font-bold text-zinc-300 max-w-[220px]">
                                    Analyze {ticker} using Phase 18 Microstructure methodology.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {messages.map((msg, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, y: 10, x: msg.role === 'user' ? 10 : -10 }}
                            animate={{ opacity: 1, y: 0, x: 0 }}
                            className={cn(
                                "flex gap-4 max-w-[92%]",
                                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-110",
                                msg.role === 'user' ? "bg-zinc-900 border border-zinc-800" : "bg-blue-600 border border-blue-500"
                            )}>
                                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                            </div>
                            <div className={cn(
                                "p-4 rounded-[24px] text-[13px] leading-relaxed font-medium shadow-sm transition-all",
                                msg.role === 'user' 
                                    ? "bg-zinc-900 text-white rounded-tr-none" 
                                    : "bg-white/80 text-zinc-700 rounded-tl-none border border-white"
                            )}>
                                <div className={cn(
                                    "prose prose-sm max-w-none prose-p:leading-relaxed prose-ul:list-disc prose-li:my-1",
                                    msg.role === 'user' ? "prose-invert prose-strong:text-blue-400" : "prose-strong:text-blue-600"
                                )}>
                                    <VSAMarkdown>
                                        {msg.content}
                                    </VSAMarkdown>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {streamingContent && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-4 max-w-[92%] mr-auto"
                        >
                            <div className="w-8 h-8 rounded-xl bg-blue-600 border border-blue-500 flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="p-4 rounded-[24px] rounded-tl-none bg-white/80 text-zinc-700 border border-white text-[13px] leading-relaxed font-medium shadow-sm">
                                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-strong:text-blue-600 prose-ul:list-disc prose-li:my-1">
                                    <VSAMarkdown>
                                        {streamingContent}
                                    </VSAMarkdown>
                                </div>
                                <span className="inline-block w-1.5 h-4 bg-blue-500 ml-1 animate-pulse rounded-full align-middle" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading && !streamingContent && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-4 mr-auto"
                    >
                        <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shadow-inner">
                            <Bot className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="bg-white/40 p-4 rounded-[24px] rounded-tl-none border border-white/50 flex items-center gap-3">
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                            <span className="text-[10px] font-black uppercase text-blue-600 tracking-[0.3em]">Decoding Bio-Flow...</span>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Input Footer */}
            <div className="p-6 border-t border-white/50 bg-white/30 backdrop-blur-md">
                {/* Quick Prompts */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                    {QUICK_PROMPTS.map((prompt, i) => (
                        <button
                            key={i}
                            onClick={() => handleSend(prompt.label)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 rounded-full text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 transition-all shrink-0 shadow-sm hover:shadow-md"
                        >
                            {prompt.icon}
                            {prompt.label}
                        </button>
                    ))}
                </div>

                <div className="relative flex items-center gap-4">
                    <div className="relative flex-1 group">
                        <input 
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="PYTANIE O WOLUMEN/ANOMALIE..."
                            className="w-full bg-white/80 border border-zinc-200 rounded-[22px] px-6 py-4 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-zinc-400 placeholder:font-black placeholder:uppercase placeholder:tracking-widest placeholder:text-[9px] shadow-sm group-hover:shadow-md"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                             <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest hidden md:block">Press Enter</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleSend()}
                        disabled={loading || !input.trim()}
                        className="bg-zinc-900 text-white p-4 rounded-[22px] hover:bg-black transition-all disabled:opacity-30 disabled:hover:bg-zinc-900 shadow-xl shadow-zinc-900/20 active:scale-95"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}
