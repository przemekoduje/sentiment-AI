"use client"

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'

interface VSATooltipProps {
  term: string
  definition: string
  category?: string
  children: React.ReactNode
}

export default function VSATooltip({ term, definition, category, children }: VSATooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = () => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipWidth = 260 // approx width from className w-64
    const viewportWidth = window.innerWidth
    const margin = 16

    // Target position: horizontally centered over the trigger, vertically above it
    let targetLeft = rect.left + rect.width / 2
    let top = rect.top + window.scrollY - 12 // 12px gap

    // Collision detection: ensure tooltip doesn't bleed out of horizontal viewport
    const halfWidth = tooltipWidth / 2
    let shiftX = 0

    if (targetLeft - halfWidth < margin) {
        // Overflow left
        shiftX = margin - (targetLeft - halfWidth)
    } else if (targetLeft + halfWidth > viewportWidth - margin) {
        // Overflow right
        shiftX = (viewportWidth - margin) - (targetLeft + halfWidth)
    }

    // Set styles
    setStyle({
      position: 'absolute',
      top: top,
      left: targetLeft + shiftX,
      transform: 'translate(-50%, -100%)',
      zIndex: 9999,
      pointerEvents: 'none',
      width: `${tooltipWidth}px`
    })

    // Arrow must always point to the center of the trigger, 
    // but the tooltip body might have shifted.
    setArrowStyle({
        left: `calc(50% - ${shiftX}px)`
    })
  }

  // Use layout effect for positioning triggered by visibility change
  useLayoutEffect(() => {
    if (isVisible) {
        updatePosition()
    }
  }, [isVisible])

  // Stay synchronized with window changes
  useEffect(() => {
    if (isVisible) {
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isVisible])

  const getCategoryStyles = () => {
    switch (category) {
      case "SOS": return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
      case "SOW": return "bg-rose-500/10 border-rose-500/20 text-rose-600"
      case "PHASE": return "bg-amber-500/10 border-amber-500/20 text-amber-600"
      default: return "bg-blue-500/10 border-blue-500/20 text-blue-600"
    }
  }

  const tooltipContent = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          style={style}
          className="p-4 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)]"
        >
          <div className="space-y-2">
            <header className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900 border-b-2 border-blue-500 pb-0.5">
                {term}
              </span>
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                getCategoryStyles()
              )}>
                {category || "VSA TERM"}
              </div>
            </header>
            <p className="text-[11px] leading-relaxed font-bold text-zinc-600">
              {definition}
            </p>
            <footer className="pt-2 flex items-center gap-1.5 border-t border-zinc-100">
              <Info className="w-3 h-3 text-zinc-300" />
              <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">VSA Bible v3 Methodology</span>
            </footer>
          </div>
          
          {/* Tooltip Arrow - anchored to the trigger regardless of tooltip body shift */}
          <div 
            style={arrowStyle}
            className="absolute top-full -translate-x-1/2 border-8 border-transparent border-t-zinc-200 transition-all duration-300" 
          />
          <div 
            style={arrowStyle}
            className="absolute top-full -translate-x-1/2 border-[7px] border-transparent border-t-white mt-[-1px] transition-all duration-300" 
          />
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <span 
        ref={triggerRef}
        className="inline-block cursor-help group relative"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        <span className={cn(
          "underline decoration-dotted decoration-zinc-300 underline-offset-4 font-black transition-all group-hover:decoration-blue-500 group-hover:text-blue-600",
          isVisible && "text-blue-600 decoration-blue-500"
        )}>
          {children}
        </span>
      </span>
      {mounted && createPortal(tooltipContent, document.body)}
    </>
  )
}
