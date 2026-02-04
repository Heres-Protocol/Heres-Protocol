'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import {
  PROMO_VIDEO,
  PROMO_TIMELINE,
  PROMO_SCENE1,
  PROMO_SCENE2,
  PROMO_SCENE3,
  PROMO_SCENE4,
  PROMO_SCENE5,
  PROMO_STYLE,
} from '@/constants/promoSpec'

const SEG1 = PROMO_TIMELINE.SCENE1_END
const SEG2 = PROMO_TIMELINE.SCENE2_END
const SEG3 = PROMO_TIMELINE.SCENE3_END
const SEG4 = PROMO_TIMELINE.SCENE4_END
const SEG5 = PROMO_TIMELINE.SCENE5_END

const OPEN_START = PROMO_SCENE4.OPEN_START
const OPEN_END = PROMO_SCENE4.OPEN_END
const BURST_START = PROMO_SCENE4.BURST_START
const BURST_PEAK = PROMO_SCENE4.BURST_PEAK
const BURST_FADE = PROMO_SCENE4.BURST_FADE
const FLASH_TIME = PROMO_SCENE4.FLASH_FRAME_TIME
const FLASH_DUR = PROMO_SCENE4.FLASH_DURATION_S
const SPLIT_PX = PROMO_SCENE4.CAPSULE_SPLIT_DISTANCE_PX
const LINE_ANGLES = PROMO_SCENE4.EXECUTION_LINES_ANGLES_DEG

export function HeresPromoReel({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const title1Ref = useRef<HTMLDivElement>(null)
  const sub1Ref = useRef<HTMLDivElement>(null)
  const title2LeftRef = useRef<HTMLDivElement>(null)
  const title2RightRef = useRef<HTMLDivElement>(null)
  const capsuleWrapRef = useRef<HTMLDivElement>(null)
  const capsuleFullRef = useRef<HTMLDivElement>(null)
  const capsuleLeftRef = useRef<HTMLDivElement>(null)
  const capsuleRightRef = useRef<HTMLDivElement>(null)
  const title3LeftRef = useRef<HTMLDivElement>(null)
  const title3RightRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLDivElement>(null)
  const title4LeftRef = useRef<HTMLDivElement>(null)
  const title4RightRef = useRef<HTMLDivElement>(null)
  const burstRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const txLinesRef = useRef<HTMLDivElement>(null)
  const title5Ref = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const solanaLogoRef = useRef<HTMLDivElement>(null)
  const fadeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0 })
      tl.timeScale(1)

      const gridDegPerSec = PROMO_STYLE.GRID_ROTATION_SPEED_DEG_PER_SEC
      const gridDuration = 360 / gridDegPerSec
      if (gridRef.current) {
        gsap.to(gridRef.current, {
          rotation: 360,
          duration: gridDuration,
          repeat: -1,
          ease: 'none',
        })
      }

      // ─── Scene 1: Opening (0 → 2s) ─────────────────────────────────────
      const textY = PROMO_SCENE1.TEXT_FADE_IN.TRANSLATE_Y_FROM
      const textDur = PROMO_SCENE1.TEXT_FADE_IN.DURATION
      tl.fromTo(
        logoRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' },
        0
      )
      tl.fromTo(
        title1Ref.current,
        { opacity: 0, y: textY },
        { opacity: 1, y: 0, duration: textDur, ease: 'power2.out' },
        0.3
      )
      tl.fromTo(
        sub1Ref.current,
        { opacity: 0, y: textY },
        { opacity: 1, y: 0, duration: textDur, ease: 'power2.out' },
        0.5
      )
      tl.to(
        [title1Ref.current, sub1Ref.current, logoRef.current],
        { opacity: 0, duration: 0.4 },
        SEG1 - 0.4
      )

      // ─── Scene 2: Define Capsule (2 → 5s) — 좌/우 텍스트 각 가운데 정렬 ─────
      tl.fromTo(
        capsuleWrapRef.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' },
        SEG1
      )
      tl.fromTo(
        [title2LeftRef.current, title2RightRef.current],
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' },
        SEG1 + 0.2
      )
      tl.to([title2LeftRef.current, title2RightRef.current], { opacity: 0, duration: 0.35 }, SEG2 - 0.35)
      tl.to(capsuleWrapRef.current, { opacity: 0, duration: 0.35 }, SEG2 - 0.35)

      // ─── Scene 3: Private Monitoring (5 → 8.5s) — 좌/우 텍스트 각 가운데 정렬 ─
      tl.fromTo(capsuleWrapRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 }, SEG2)
      tl.fromTo(
        scanRef.current,
        { opacity: 0 },
        { opacity: PROMO_SCENE3.SCAN_BEAM.OPACITY, duration: 0.4 },
        SEG2 + 0.2
      )
      tl.fromTo(
        [title3LeftRef.current, title3RightRef.current],
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' },
        SEG2 + 0.3
      )
      tl.to([title3LeftRef.current, title3RightRef.current, scanRef.current], { opacity: 0, duration: 0.35 }, SEG3 - 0.35)
      tl.to(capsuleWrapRef.current, { opacity: 0, duration: 0.35 }, SEG3 - 0.35)

      // ─── Scene 4: Capsule Open + Execution Burst (8.5 → 12s) ──────────────
      tl.fromTo(capsuleWrapRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 }, SEG3)
      tl.fromTo(
        [title4LeftRef.current, title4RightRef.current],
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' },
        SEG3 + 0.2
      )

      // Full capsule visible until open starts; halves hidden
      tl.set(capsuleFullRef.current, { opacity: 1 }, SEG3)
      tl.set([capsuleLeftRef.current, capsuleRightRef.current], { opacity: 0, x: 0 }, SEG3)

      // At OPEN_START: hide full, show halves at 0 then split to ±SPLIT_PX
      tl.set(capsuleFullRef.current, { opacity: 0 }, OPEN_START)
      tl.set([capsuleLeftRef.current, capsuleRightRef.current], { opacity: 1, x: 0 }, OPEN_START)
      tl.to(capsuleLeftRef.current, {
        x: -SPLIT_PX,
        duration: OPEN_END - OPEN_START,
        ease: 'power2.out',
      }, OPEN_START)
      tl.to(capsuleRightRef.current, {
        x: SPLIT_PX,
        duration: OPEN_END - OPEN_START,
        ease: 'power2.out',
      }, OPEN_START)

      // Execution burst light: 9.15 → 1, peak 9.25, fade by 9.8
      tl.fromTo(
        burstRef.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: BURST_PEAK - BURST_START, ease: 'power2.out' },
        BURST_START
      )
      tl.to(burstRef.current, {
        opacity: 0,
        duration: BURST_FADE - BURST_PEAK,
        ease: 'power2.in',
      }, BURST_PEAK)

      // Global screen flash at 9.25s, duration 0.15s
      tl.fromTo(
        flashRef.current,
        { opacity: 0 },
        { opacity: PROMO_SCENE4.FLASH_OPACITY, duration: FLASH_DUR * 0.5, ease: 'power2.out' },
        FLASH_TIME
      )
      tl.to(flashRef.current, {
        opacity: 0,
        duration: FLASH_DUR * 0.5,
        ease: 'power2.in',
      }, FLASH_TIME + FLASH_DUR * 0.5)

      // Execution lines: expand from center ~9.2s, duration 0.7s, then fade 1s
      const lineStart = BURST_START + 0.05
      tl.fromTo(
        txLinesRef.current,
        { opacity: 0, '--line-length': '0px' },
        {
          opacity: PROMO_SCENE4.LINE_OPACITY.PEAK,
          '--line-length': `${PROMO_SCENE4.LINE_EXPANSION.MAX_LENGTH_PX}px`,
          duration: PROMO_SCENE4.LINE_EXPANSION.DURATION_S,
          ease: 'power2.out',
        },
        lineStart
      )
      tl.to(txLinesRef.current, {
        opacity: 0,
        duration: PROMO_SCENE4.LINE_OPACITY.FADE_OUT_DURATION_S,
      }, lineStart + PROMO_SCENE4.LINE_EXPANSION.DURATION_S)

      tl.to([title4LeftRef.current, title4RightRef.current, txLinesRef.current, capsuleWrapRef.current], {
        opacity: 0,
        duration: 0.35,
      }, SEG4 - 0.35)

      // ─── Scene 5: Closing (12 → 15s) ────────────────────────────────────
      tl.fromTo(
        title5Ref.current,
        { opacity: 0, y: PROMO_STYLE.TEXT_SLIDE_DISTANCE_PX },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
        SEG4
      )
      tl.fromTo(ctaRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, SEG4 + 0.4)
      tl.fromTo(capsuleWrapRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 }, SEG4 + 0.2)
      tl.fromTo(solanaLogoRef.current, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5 }, SEG4 + 0.5)
      tl.to(capsuleWrapRef.current, { opacity: 0, duration: 0.3 }, SEG4 + 0.5)
      tl.to([title5Ref.current, ctaRef.current, solanaLogoRef.current], { opacity: 0, duration: 0.4 }, SEG5 - 0.5)
      tl.to(fadeRef.current, { opacity: 1, duration: PROMO_SCENE5.GLOBAL_FADE_OUT.DURATION_S }, SEG5 - 0.5)
      tl.to(fadeRef.current, { opacity: 0, duration: 0.1 }, SEG5)
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`promo-reel relative aspect-video w-full overflow-hidden rounded-xl bg-[#050810] ${className}`}
      style={{ color: PROMO_STYLE.TEXT_COLOR }}
    >

      {/* Background grid: 6°/s, opacity from spec */}
      <div
        ref={gridRef}
        className="promo-grid absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(34,211,238,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          transform: 'perspective(800px) rotateX(18deg)',
          transformOrigin: 'center center',
          opacity: PROMO_STYLE.GRID_OPACITY,
        }}
      />

      {/* Scene 1: 0–2s — 로고·텍스트 블록 세로 가운데 정렬 */}
      <div ref={logoRef} className="promo-abs center top-[20%] opacity-0">
        <Image src="/logo-white.png" alt="Heres" width={80} height={80} className="h-16 w-auto sm:h-20" />
      </div>
      <div ref={title1Ref} className="promo-abs center top-[38%] text-center opacity-0">
        <p className="text-lg font-bold sm:text-xl leading-snug">{PROMO_SCENE1.TEXT_TITLE}</p>
      </div>
      <div ref={sub1Ref} className="promo-abs center top-[52%] text-center opacity-0">
        <p className="text-sm text-white/80 leading-relaxed">{PROMO_SCENE1.TEXT_SUB}</p>
      </div>

      {/* Scene 2: 2–5s — 좌/우 각 가운데 정렬, 세로는 캡슐 중앙 */}
      <div ref={title2LeftRef} className="promo-abs promo-half-left opacity-0">
        <p className="text-sm font-medium sm:text-base leading-snug text-center">{PROMO_SCENE2.TEXT_TITLE}</p>
      </div>
      <div ref={title2RightRef} className="promo-abs promo-half-right opacity-0">
        <p className="text-xs text-white/70 leading-relaxed text-center max-w-[85%]">{PROMO_SCENE2.TEXT_SUB}</p>
      </div>

      {/* Capsule: wrapper holds full (scenes 2–3) and halves (scene 4 open) */}
      <div ref={capsuleWrapRef} className="promo-abs promo-capsule-wrap opacity-0">
        <div ref={capsuleFullRef} className="promo-capsule promo-capsule-full" />
        <div ref={capsuleLeftRef} className="promo-capsule-half promo-capsule-left" />
        <div ref={capsuleRightRef} className="promo-capsule-half promo-capsule-right" />
      </div>

      {/* Scene 3: 5–8.5s — 좌/우 각 가운데 정렬, 세로는 캡슐 중앙 */}
      <div ref={title3LeftRef} className="promo-abs promo-half-left opacity-0">
        <p className="text-sm font-medium sm:text-base leading-snug text-center">{PROMO_SCENE3.TEXT_TITLE}</p>
      </div>
      <div ref={title3RightRef} className="promo-abs promo-half-right opacity-0">
        <p className="text-xs text-white/80 leading-relaxed text-center max-w-[85%]">{PROMO_SCENE3.TEXT_SUB}</p>
      </div>
      <div ref={scanRef} className="promo-abs promo-scan opacity-0" />

      {/* Scene 4: 8.5–12s — 좌/우 각 가운데 정렬 */}
      <div ref={title4LeftRef} className="promo-abs promo-half-left opacity-0">
        <p className="text-sm font-medium sm:text-base leading-snug text-center max-w-[85%]">{PROMO_SCENE4.TEXT_TITLE}</p>
      </div>
      <div ref={title4RightRef} className="promo-abs promo-half-right opacity-0">
        <p className="text-xs text-white/80 leading-relaxed text-center max-w-[85%]">{PROMO_SCENE4.TEXT_SUB}</p>
      </div>
      <div
        ref={txLinesRef}
        className="promo-abs promo-txlines opacity-0"
        style={{ ['--line-length' as string]: '0px' }}
      >
        {LINE_ANGLES.map((angle) => (
          <div
            key={angle}
            className="promo-txline"
            style={{ transform: `rotate(${angle}deg)` }}
          />
        ))}
      </div>
      <div ref={burstRef} className="promo-abs inset-0 promo-burst opacity-0 pointer-events-none" />
      <div ref={flashRef} className="promo-abs inset-0 promo-flash opacity-0 pointer-events-none" />

      {/* Scene 5: 12–15s — 로고·타이틀·CTA 세로 간격 분리, 겹침 방지 */}
      <div ref={solanaLogoRef} className="promo-abs center top-[24%] opacity-0">
        <Image src="/logos/solana.svg" alt="Solana" width={64} height={64} className="h-12 w-auto sm:h-16" />
      </div>
      <div ref={title5Ref} className="promo-abs center top-[44%] text-center opacity-0">
        <p className="text-base font-bold sm:text-lg leading-snug">{PROMO_SCENE5.TEXT_TITLE}</p>
      </div>
      <div ref={ctaRef} className="promo-abs center top-[62%] text-center opacity-0">
        <p className="text-xs font-medium text-cyan-300/90 sm:text-sm leading-relaxed">{PROMO_SCENE5.TEXT_SUB}</p>
      </div>

      <div ref={fadeRef} className="promo-abs inset-0 bg-black/80 opacity-0 pointer-events-none" />
    </div>
  )
}
