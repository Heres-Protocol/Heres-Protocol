'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ARCHITECTURE_STEPS } from '@/constants/architecture'

const Actors = ['Client', 'Server', 'Facilitator', 'Blockchain']
const ActorLabels: Record<string, string> = {
  Client: 'User Wallet',
  Server: 'Lucid Capsule',
  Facilitator: 'Noir ZK',
  Blockchain: 'Solana'
}

interface SequenceDiagramProps {
  activeStep: number | null
  onStepHover: (id: number | null) => void
}

export const SequenceDiagram: React.FC<SequenceDiagramProps> = ({ activeStep, onStepHover }) => {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })

  const getXPosition = (actor: string) => {
    const index = Actors.indexOf(actor)
    return `${12.5 + index * 25}%`
  }

  // Zoom logic
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.85 : 1.15
      setScale(prev => Math.min(Math.max(prev * delta, 0.4), 4))
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel)
      }
    }
  }, [handleWheel])

  // Pan logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    setIsDragging(true)
    lastMousePos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastMousePos.current.x
    const dy = e.clientY - lastMousePos.current.y
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    lastMousePos.current = { x: e.clientX, y: e.clientY }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div 
      className={`relative w-full rounded-3xl mb-8 select-none border-2 border-[#A0ECFF]/45 shadow-xl bg-[#0c1222]/95 overflow-hidden group/viewport backdrop-blur-sm ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
    >
      <style>{`
        @keyframes flow-right {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes flow-left {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-flow-right {
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.8), transparent);
          background-size: 200% 100%;
          animation: flow-right 2s linear infinite;
        }
        .animate-flow-left {
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.8), transparent);
          background-size: 200% 100%;
          animation: flow-left 2s linear infinite;
        }
        .active-flow {
          animation-duration: 1s !important;
          background: linear-gradient(90deg, transparent, #60a5fa, transparent);
          background-size: 200% 100%;
        }
      `}</style>

      {/* Viewport Transform Wrapper */}
      <div 
        className={`p-4 md:p-8 origin-top will-change-transform ${isDragging ? 'transition-none' : 'transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1)'}`}
        style={{ 
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
        }}
      >
        {/* Actor Headers */}
        <div className="flex justify-between mb-8 relative z-30">
          {Actors.map((actor) => (
            <div key={actor} className="flex flex-col items-center w-1/4">
              <div className="px-3 py-2 rounded-lg bg-[#A0ECFF]/10 border-2 border-[#A0ECFF]/50 text-[#A0ECFF] font-black mb-2 min-w-[90px] md:min-w-[120px] text-center shadow-lg">
                <span className="tracking-widest text-[9px] md:text-[10px] uppercase">{actor}</span>
                <div className="text-[7px] md:text-[8px] font-medium mt-0.5 uppercase tracking-[0.15em] text-slate-200">
                  {ActorLabels[actor]}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dynamic Steps Container */}
        <div className="relative z-10 space-y-1.5 pb-12">
          {/* Lifelines */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {Actors.map((actor) => (
              <div 
                key={`lifeline-${actor}`}
                className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-slate-500 via-slate-500/50 to-transparent" 
                style={{ left: getXPosition(actor) }} 
              />
            ))}
          </div>

          {/* Dimming Layer */}
          <div 
            className={`absolute inset-0 bg-[#0f1629]/30 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-none z-40 ${activeStep !== null ? 'opacity-100' : 'opacity-0'}`} 
          />

          {ARCHITECTURE_STEPS.map((step, idx) => {
            const isSameActor = step.from === step.to
            const fromX = getXPosition(step.from)
            const toX = getXPosition(step.to)
            const isActive = activeStep === step.id
            const isBottomSteps = idx > ARCHITECTURE_STEPS.length - 4
            const isRightFlow = parseFloat(toX) > parseFloat(fromX)

            return (
              <div 
                key={step.id} 
                className={`relative transition-all duration-300 group min-h-[48px] flex items-center ${isActive ? 'z-[50] opacity-100' : activeStep !== null ? 'opacity-20 blur-[1px]' : 'z-10 opacity-100'}`}
                onMouseEnter={() => onStepHover(step.id)}
                onMouseLeave={() => onStepHover(null)}
              >
                {/* Arrow Line Drawing with Flow Animation */}
                <div className="absolute inset-0 pointer-events-none">
                  {!isSameActor ? (
                    <div 
                      className={`absolute h-[1.5px] transition-all duration-500 top-1/2 -translate-y-1/2 ${isActive ? 'scale-y-150' : ''}`}
                      style={{
                        left: `calc(${Math.min(parseFloat(fromX), parseFloat(toX))}% + 1px)`,
                        width: `calc(${Math.abs(parseFloat(fromX) - parseFloat(toX))}% - 2px)`,
                        background: isActive ? '#A0ECFF' : 'rgba(148, 163, 184, 0.6)'
                      }}
                    >
                      {/* Flowing Pulse */}
                      <div className={`absolute inset-0 ${isRightFlow ? 'animate-flow-right' : 'animate-flow-left'} ${isActive ? 'active-flow' : ''}`} 
                           style={{ animationDelay: `${idx * 0.1}s` }} />
                      
                      <div 
                        className={`absolute w-2 h-2 border-t-2 border-r-2 transform transition-all duration-300 ${isActive ? 'border-[#A0ECFF] shadow-[0_0_8px_rgba(160,236,255,0.6)]' : 'border-slate-400'}`}
                        style={{
                          right: isRightFlow ? '-1px' : 'auto',
                          left: !isRightFlow ? '-1px' : 'auto',
                          top: '-3.5px',
                          rotate: isRightFlow ? '45deg' : '225deg'
                        }}
                      />
                    </div>
                  ) : (
                    <div 
                      className={`absolute w-10 h-8 border-2 border-l-0 rounded-r-xl transition-all duration-300 top-1/2 -translate-y-1/2 ${isActive ? 'border-[#A0ECFF] shadow-[0_0_12px_rgba(160,236,255,0.4)]' : 'border-slate-500'}`}
                      style={{
                        left: fromX,
                        marginLeft: '1px'
                      }}
                    >
                      {/* Loop Animation */}
                      <div className={`absolute inset-0 rounded-r-xl animate-pulse opacity-40 bg-[#A0ECFF]/20`} />
                      
                      <div 
                        className={`absolute bottom-[-5px] left-[-3.5px] w-2 h-2 border-b-2 border-l-2 transform rotate-[-45deg] transition-all duration-300 ${isActive ? 'border-[#A0ECFF]' : 'border-slate-500'}`}
                      />
                    </div>
                  )}
                </div>

                {/* Step Label Box */}
                <div 
                  className="absolute transition-transform duration-300 top-1/2 -translate-y-1/2"
                  style={{
                    left: isSameActor ? `calc(${fromX} + 12px)` : `calc(${Math.min(parseFloat(fromX), parseFloat(toX))}% + ${Math.abs(parseFloat(fromX) - parseFloat(toX)) / 2}% - 70px)`,
                  }}
                >
                  <div className="relative cursor-help group">
                    <div className={`
                      absolute -left-2 -top-2 flex items-center justify-center w-6 h-6 rounded-full border-2 text-[10px] font-black transition-all duration-300 z-20 shadow-lg
                      ${isActive 
                        ? 'bg-[#A0ECFF] border-[#A0ECFF] text-[#0c1222] scale-110' 
                        : 'bg-[#A0ECFF]/20 border-[#A0ECFF]/50 text-[#A0ECFF]'}
                    `}>
                      {step.id}
                    </div>

                    <div className={`
                      px-4 py-1.5 rounded-lg border-2 text-[9px] md:text-[10px] font-bold tracking-tight transition-all duration-300 min-w-[120px] md:min-w-[140px] text-center
                      ${isActive 
                        ? 'bg-[#A0ECFF]/25 border-[#A0ECFF] text-white shadow-lg shadow-[#A0ECFF]/25' 
                        : 'bg-[#0f1629]/90 border-[#A0ECFF]/40 text-slate-200'}
                    `}>
                      {step.label}
                    </div>
                  </div>
                </div>

                {/* Tooltip detail */}
                {isActive && (
                  <div 
                    className={`absolute left-1/2 -translate-x-1/2 w-72 md:w-80 p-5 bg-[#0c1222]/98 border-2 border-[#A0ECFF]/60 rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-300 pointer-events-none ring-2 ring-[#A0ECFF]/30 backdrop-blur-sm
                      ${isBottomSteps ? 'bottom-full mb-4' : 'top-full mt-4'}`}
                    style={{
                      transform: `scale(${1 / scale}) translateX(-50%)`,
                      transformOrigin: 'center bottom',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[#A0ECFF] font-black uppercase tracking-[0.2em] text-[9px]">Node {step.id} Detail</span>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-[#A0ECFF]/60 to-transparent" />
                    </div>
                    <p className="text-white font-black text-sm md:text-base mb-2 leading-tight tracking-tight">{step.label}</p>
                    <p className="text-slate-300 leading-relaxed text-[11px] font-medium">{step.description}</p>
                    {step.sideEffect && (
                      <div className="mt-4 pt-3 border-t border-white/10 text-[9px] font-mono text-emerald-400 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="opacity-60 uppercase tracking-widest">Runtime:</span> {step.sideEffect}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
