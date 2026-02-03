'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRef, useEffect, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CapsuleMediaBlock } from '@/components/CapsuleMediaBlock'
import { AsciiCapsule } from '@/components/AsciiCapsule'
gsap.registerPlugin(ScrollTrigger)

function DashedLine({
  height = 50,
  segmentIndex,
  activeWhyIndex,
}: {
  height?: number
  segmentIndex: number
  activeWhyIndex: number
}) {
  const active = activeWhyIndex >= segmentIndex
  const filled = activeWhyIndex > segmentIndex
  return (
    <div className="relative flex justify-center" style={{ height }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox={`0 0 2 ${height}`}
        width={2}
        height={height}
        className="shrink-0 text-white why-flow-dashed-line"
      >
        <path
          stroke="currentColor"
          strokeDasharray="5 5"
          strokeLinecap="square"
          strokeOpacity={0.5}
          strokeWidth={1.5}
          d={`M1 1v${height - 2}`}
        />
      </svg>
      {filled && (
        <div
          className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-lucid-accent rounded-full"
          aria-hidden
          style={{ height }}
        />
      )}
      {active && !filled && (
        <div
          className="why-flow-segment absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 bg-lucid-accent rounded-full"
          aria-hidden
        />
      )}
    </div>
  )
}

/** Multiple parallel dashed lines (reference: Substreams diagram) */
function ParallelDashedLines({
  height = 32,
  segmentIndex,
  activeWhyIndex,
  count = 4,
}: {
  height?: number
  segmentIndex: number
  activeWhyIndex: number
  count?: number
}) {
  const active = activeWhyIndex >= segmentIndex
  const filled = activeWhyIndex > segmentIndex
  const width = Math.max(count * 6, 24)
  const step = width / (count + 1)
  return (
    <div className="relative flex justify-center" style={{ height, width }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="shrink-0 text-white why-flow-dashed-line"
      >
        {Array.from({ length: count }).map((_, i) => (
          <path
            key={i}
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeLinecap="square"
            strokeOpacity={0.5}
            strokeWidth={1}
            d={`M${step + i * step} 0v${height}`}
          />
        ))}
      </svg>
      {filled &&
        Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-lucid-accent rounded-full"
            style={{ left: `${step + i * step}px`, height }}
            aria-hidden
          />
        ))}
      {active && !filled && (
        <div
          className="why-flow-segment absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 bg-lucid-accent rounded-full"
          aria-hidden
        />
      )}
    </div>
  )
}

const features = [
  {
    title: 'Zero Latency',
    description:
      'Fast execution thanks to Magicblock PER (TEE) / Ephemeral Rollups. Conditions are checked privately in TEE and execution is triggered when silence becomes truth.',
    icon: '⚡',
  },
  {
    title: 'Zero Trust',
    description:
      'No third-party executor. Your capsule lives on Solana; Magicblock PER (TEE) monitors privately. Execution is automatic when conditions are met.',
    icon: '🔒',
  },
  {
    title: 'Compliant Privacy',
    description:
      'Conditions stay private inside PER (TEE) / Private Ephemeral Rollups. Only execution results are committed to Devnet. Built for Solana with Helius & Phantom.',
    icon: '🛡️',
  },
]

/* Why Heres – benefit-focused cards (non-technical, why you need Heres) */
const whyHeresCards = [
  {
    title: 'Your intent, executed when it matters',
    description: 'Leave instructions that run only when the time is right. No one can execute early. Your conditions stay yours until the moment you chose.',
    image: '/why-lucid-1.png',
    href: '/create',
  },
  {
    title: 'Privacy by design',
    description: 'Your conditions stay private. Only the outcome is visible on-chain. No third party sees your rules. Just the result when silence becomes truth.',
    image: '/why-lucid-2.png',
    href: '/dashboard',
  },
  {
    title: 'Set it once. It runs when you’re silent.',
    description: 'Define your intent once. No bridges, no middlemen. When your conditions are met, execution happens automatically, the way you wanted.',
    image: '/why-lucid-3.png',
    href: '/create',
  },
]

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const whySectionRef = useRef<HTMLElement>(null)
  const whyTitleRef = useRef<HTMLHeadingElement>(null)
  const whyLeftRef = useRef<HTMLDivElement>(null)
  const whyVisualMainRef = useRef<HTMLDivElement>(null)
  const howTitleRef = useRef<HTMLHeadingElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const partnersSectionRef = useRef<HTMLElement>(null)
  const unleashRef = useRef<HTMLElement>(null)
  const [activeWhyIndex, setActiveWhyIndex] = useState(0)
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(heroRef.current?.querySelector('h1') ?? {}, {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power3.out',
      })
      gsap.from(heroRef.current?.querySelector('[data-hero-ascii]') ?? {}, {
        opacity: 0,
        y: 24,
        duration: 0.9,
        delay: 0.3,
        ease: 'power3.out',
      })
      gsap.from(heroRef.current?.querySelector('[data-hero-below-capsule]') ?? {}, {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.6,
        ease: 'power3.out',
      })
      // Why Build – Your development environment: same scroll animations as The Graph subgraphs
      if (whySectionRef.current) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: whySectionRef.current,
            start: 'top 82%',
            end: 'top 20%',
            once: true,
          },
        })
        if (whyTitleRef.current) {
          tl.from(whyTitleRef.current, { opacity: 0, y: 28, duration: 0.65, ease: 'power3.out' })
        }
        const whyHeading = whySectionRef.current.querySelector('[data-why-heading]')
        if (whyHeading) {
          tl.from(whyHeading, { opacity: 0, y: 20, duration: 0.5, ease: 'power3.out' }, '-=0.4')
        }
        if (whyLeftRef.current) {
          const cards = whyLeftRef.current.querySelectorAll('[data-gsap-why-card]')
          tl.fromTo(cards, { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.12, ease: 'power3.out' }, '-=0.35')
        }
        if (whyVisualMainRef.current) {
          tl.from(whyVisualMainRef.current, { x: 48, opacity: 0, duration: 0.7, ease: 'power3.out' }, '-=0.45')
        }
      }
      if (howTitleRef.current) {
        ScrollTrigger.create({
          trigger: howTitleRef.current,
          start: 'top 85%',
          onEnter: () => {
            gsap.from(howTitleRef.current, { opacity: 0, y: 30, duration: 0.7, ease: 'power3.out' })
          },
          once: true,
        })
      }
      if (stepsRef.current) {
        const stepEls = stepsRef.current.querySelectorAll('[data-gsap-step]')
        gsap.fromTo(
          stepEls,
          { y: 32 },
          {
            y: 0,
            scrollTrigger: { trigger: stepsRef.current, start: 'top 88%', once: true },
            stagger: 0.12,
            duration: 0.5,
            ease: 'power3.out',
          }
        )
      }
      if (partnersSectionRef.current) {
        gsap.from(partnersSectionRef.current.querySelector('h2'), {
          scrollTrigger: { trigger: partnersSectionRef.current, start: 'top 85%', once: true },
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: 'power3.out',
        })
      }
      if (unleashRef.current) {
        const left = unleashRef.current.querySelector('[data-gsap-unleash-text]')
        const right = unleashRef.current.querySelector('[data-gsap-unleash-3d]')
        gsap.from(left, {
          scrollTrigger: { trigger: unleashRef.current, start: 'top 80%', once: true },
          opacity: 0,
          x: -50,
          duration: 0.9,
          ease: 'power3.out',
        })
        gsap.from(right, {
          scrollTrigger: { trigger: unleashRef.current, start: 'top 80%', once: true },
          opacity: 0,
          x: 50,
          duration: 0.9,
          delay: 0.2,
          ease: 'power3.out',
        })
      }
    })
    return () => ctx.revert()
  }, [])

  return (
    <div className="bg-hero">
      {/* Hero */}
      <section
        ref={heroRef}
        className="relative overflow-hidden px-4 pt-32 pb-28 sm:px-6 sm:pt-40 sm:pb-36 lg:px-8"
      >
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-lucid-accent">
            Privacy-Preserving Capsule Protocol
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-lucid-white sm:text-5xl lg:text-6xl">
            Your intent. Your rules.{' '}
            <span className="bg-gradient-to-r from-lucid-cyan to-lucid-purple bg-clip-text text-transparent">
              Executed when you’re silent.
            </span>
          </h1>
          {/* ASCII capsule animation – capsule-shaped ASCII art */}
          <div className="mt-10 sm:mt-12" data-hero-ascii>
            <AsciiCapsule />
          </div>
          {/* 캡슐 아래 문구 + Get Started 버튼 */}
          <div className="mt-10 sm:mt-12 text-center" data-hero-below-capsule>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-lucid-muted leading-relaxed">
              Define once. Delegate to Magicblock PER (TEE). Execution runs on Solana when conditions are met. No bridges, no third party.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/create"
                className="btn-primary min-w-[160px] shrink-0 rounded-full py-3.5 text-center shadow-[0_0_24px_rgba(34,211,238,0.3)]"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Build With Heres – Your development environment (layout + scroll like The Graph subgraphs) */}
      <section ref={whySectionRef} className="why-build-section py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 ref={whyTitleRef} className="text-center text-3xl font-bold text-white sm:text-4xl">
            Why Build With Heres?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lucid-muted hidden">
            Capsules on Solana, private logic in Magicblock PER (TEE), execution when you’re silent.
          </p>

          <div data-why-heading className="mx-auto mt-3 max-w-2xl text-center">
            <p className="why-build-subtitle text-lg font-medium">Your development environment</p>
            <p className="why-build-desc mt-2">Everything you need to build privacy-preserving capsules on Solana.</p>
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
            {/* Left: Why Heres steps – vertical list with left border (Firehose-style) */}
            <div ref={whyLeftRef} className="why-left-cards flex flex-col">
              {whyHeresCards.map((card, i) => {
                const isActive = activeWhyIndex === i
                return (
                  <div
                    key={card.title}
                    role="button"
                    tabIndex={0}
                    data-gsap-why-card
                    data-active={isActive}
                    onClick={() => setActiveWhyIndex(i)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveWhyIndex(i) } }}
                    className={`flex cursor-pointer flex-col py-6 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                  >
                    <div
                      className={`relative flex items-start transition-all duration-300 ${isActive ? 'pl-4' : 'pl-0'}`}
                      style={{
                        borderLeft: isActive ? '1px solid rgba(34, 211, 238, 0.3)' : '1px solid transparent',
                      }}
                    >
                      {isActive && (
                        <div
                          key={`step-bar-${i}`}
                          className="why-build-step-bar absolute left-0 top-0 w-0.5 bg-lucid-accent"
                          aria-hidden
                          onAnimationEnd={() => setActiveWhyIndex((prev) => (prev + 1) % whyHeresCards.length)}
                        />
                      )}
                      <div>
                        <div className="mb-1 font-mono text-[13px] text-white/40">
                          Step {i + 1}
                        </div>
                        <h3 className="mb-4 text-[18px] font-medium text-white">
                          {card.title}
                        </h3>
                        <p className="text-white/60">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Right: Heres flow diagram – no outer box, widened to the right (reference image) */}
            <div ref={whyVisualMainRef} className="relative w-full md:min-w-0 md:flex-1 lg:max-w-[900px]">
              <div className="why-build-flow-wrap relative flex flex-col md:flex-row md:items-stretch md:gap-0 md:pl-2 md:pr-4">
                {/* Left flow only: Solana Devnet → … → MONITORING → Helius RPC → Execution */}
                <div className="relative mt-4 flex w-full flex-col items-center text-white md:mt-0 md:w-full md:scale-100">
                  {/* 1. Solana Devnet */}
                  <div
                    className="z-10 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transform: activeWhyIndex >= 0 ? 'scale(1)' : 'scale(0.98)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="rounded-lg border border-white/10 bg-[#242236] p-3 text-center md:p-4 w-[164px]">
                      <div className="flex items-center justify-center gap-2 font-mono text-[13px] md:text-base text-white whitespace-nowrap">
                        <Image src="/logos/solana.svg" alt="Solana" width={24} height={24} className="shrink-0" />
                        <span>Solana Devnet</span>
                      </div>
                    </div>
                  </div>
                  {/* Ref: single dashed line + absolute blue segment (h-6, 1.5px) */}
                  <div className="relative flex justify-center" style={{ opacity: 1 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2 50" width={2} height={50} className="shrink-0 text-white">
                      <path stroke="currentColor" strokeDasharray="5 5" strokeLinecap="square" strokeOpacity={0.5} strokeWidth={1.5} d="M1 1v48" />
                    </svg>
                    {activeWhyIndex > 0 && (
                      <div className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-lucid-accent rounded-full" aria-hidden style={{ height: 50 }} />
                    )}
                    {activeWhyIndex === 0 && (
                      <div className="why-flow-segment absolute left-1/2 h-6 w-[1.5px] -translate-x-1/2 rounded-full bg-lucid-accent" aria-hidden style={{ top: 0 }} />
                    )}
                  </div>
                  {/* 2. Heres Capsules */}
                  <div
                    className="z-10 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transform: activeWhyIndex >= 0 ? 'scale(1)' : 'scale(0.98)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="rounded-md w-[164px] border border-white/10 bg-[#242236] p-3 text-center md:p-4">
                      <div className="font-mono text-[13px] md:text-base text-white">Heres Capsules</div>
                    </div>
                  </div>
                  {/* Ref: 5 separate parallel dashed lines (each 2×30) */}
                  <div className="relative -z-10 flex w-full justify-center gap-2 md:gap-6" style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transition: 'opacity 0.3s' }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="relative flex justify-center" style={{ opacity: 1 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2 30" width={2} height={30} className="shrink-0 text-white">
                          <path stroke="currentColor" strokeDasharray="5 5" strokeLinecap="square" strokeOpacity={0.5} strokeWidth={1.5} d="M1 1v28" />
                        </svg>
                        {activeWhyIndex > 1 && <div className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-lucid-accent rounded-full" style={{ height: 30 }} aria-hidden />}
                      </div>
                    ))}
                  </div>
                  {/* Tokens or NFTs (middle label) */}
                  <div
                    className="z-20 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transform: activeWhyIndex >= 0 ? 'scale(1)' : 'scale(0.95)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="rounded-md w-[140px] whitespace-nowrap border border-white/10 bg-[#242236] px-1.5 py-1 text-center font-mono text-[11px] uppercase leading-none text-white/60">
                      Tokens or NFTs
                    </div>
                  </div>
                  {/* Ref: 5 parallel dashed lines again */}
                  <div className="relative -z-10 flex w-full justify-center gap-2 md:gap-6" style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transition: 'opacity 0.3s' }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="relative flex justify-center" style={{ opacity: 1 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2 30" width={2} height={30} className="shrink-0 text-white">
                          <path stroke="currentColor" strokeDasharray="5 5" strokeLinecap="square" strokeOpacity={0.5} strokeWidth={1.5} d="M1 1v28" />
                        </svg>
                        {activeWhyIndex > 1 && <div className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-lucid-accent rounded-full" style={{ height: 30 }} aria-hidden />}
                      </div>
                    ))}
                  </div>
                  {/* 3. Magicblock PER (TEE) (with PRIVACY below) */}
                  <div
                    className="relative z-20 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 1 ? 1 : 0.4, transform: activeWhyIndex >= 1 ? 'scale(1)' : 'scale(0.95)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="flex flex-col items-center gap-1 rounded-md border border-white/10 bg-[#242236] px-3 py-2 leading-none md:px-4 md:py-2.5 min-w-[220px] w-[220px]">
                      <div className="flex items-center gap-2 justify-center whitespace-nowrap">
                        <Image src="/logos/magicblock.svg" alt="Magicblock" width={20} height={20} className="shrink-0" />
                        <span className="font-mono text-[11px] uppercase text-white/60">Magicblock PER (TEE)</span>
                      </div>
                      <span className="font-mono text-[9px] uppercase text-white/40">Privacy</span>
                    </div>
                  </div>
                  <div className="relative flex justify-center">
                    <DashedLine height={30} segmentIndex={2} activeWhyIndex={activeWhyIndex} />
                  </div>
                  {/* 4. Monitoring (with Helius RPC inside) */}
                  <div
                    className="z-10 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 1 ? 1 : 0.4, transform: activeWhyIndex >= 1 ? 'scale(1)' : 'scale(0.98)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="flex flex-col items-center gap-1 rounded-md border border-white/10 bg-[#242236] px-3 py-2 leading-none md:px-4 md:py-2.5 w-[164px]">
                      <div className="flex items-center gap-2 justify-center leading-none">
                        <Image src="/logos/helius.svg" alt="Helius" width={18} height={18} className="shrink-0" />
                        <span className="font-mono text-[11px] uppercase text-white/60">Monitoring</span>
                      </div>
                      <span className="font-mono text-[10px] uppercase text-white/50 leading-none">Helius RPC</span>
                    </div>
                  </div>
                  <div className="relative flex justify-center">
                    <DashedLine height={28} segmentIndex={2} activeWhyIndex={activeWhyIndex} />
                  </div>
                  {/* 5. Execution – blue fill by STEP 1/2/3 (activeWhyIndex 0/1/2) */}
                  <div
                    className="z-10 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transform: activeWhyIndex >= 0 ? 'scale(1)' : 'scale(0.98)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="relative overflow-hidden rounded-lg border border-lucid-accent/30 bg-[#242236] p-3.5 text-center w-[220px] min-w-[220px]">
                      {/* Blue fill: STEP 1 → 33%, STEP 2 → 66%, STEP 3 → 100% */}
                      <div
                        className="absolute inset-0 rounded-lg bg-lucid-accent/25 transition-all duration-500 ease-out"
                        style={{ width: `${((activeWhyIndex + 1) / 3) * 100}%` }}
                        aria-hidden
                      />
                      <div className="relative z-10">
                        <div className="font-mono text-[13px] font-medium text-white">Execution</div>
                        <div className="mt-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-white/60">Auto execute to Devnet</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works – 3-step cards (Discover / Query / Serve style) */}
      <section className="border-y border-lucid-border/30 bg-lucid-surface/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 ref={howTitleRef} className="text-center text-3xl font-bold text-lucid-white sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lucid-muted">
            With Heres, define your intent once on Solana. Magicblock PER (TEE) monitors privately; execution runs on Devnet when conditions are met.
          </p>
          <div ref={stepsRef} className="mt-16 grid gap-8 lg:grid-cols-3 lg:items-stretch">
            {/* STEP 1 Create – capsule/create page card */}
            <div data-gsap-step className="card-lucid flex min-h-[420px] flex-col overflow-hidden p-6 transition-all duration-300 hover:border-lucid-accent/40 sm:min-h-0">
              <p className="text-xs font-medium uppercase tracking-wider text-lucid-accent">Step 1</p>
              <h3 className="mt-1 text-xl font-bold text-lucid-white">Create</h3>
              <p className="mt-3 text-sm text-lucid-muted">
                Create a capsule to define beneficiaries, amounts, and inactivity period on Solana Devnet.
              </p>
              <div className="mt-6 min-h-[200px] flex-1 overflow-hidden rounded-xl border border-lucid-border/50 bg-lucid-card/80 sm:min-h-[180px]">
                <div className="relative h-full min-h-[180px] w-full">
                  <Image
                    src="/how-it-works-step1.png"
                    alt="Create Capsule – intent, beneficiaries, asset type"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
              </div>
              <Link href="/create" className="mt-4 text-sm font-medium text-lucid-accent hover:underline">
                View the create page →
              </Link>
            </div>

            {/* STEP 2 Delegate – real code from lib/solana.ts */}
            <div data-gsap-step className="card-lucid flex min-h-[420px] flex-col overflow-hidden p-6 transition-all duration-300 hover:border-lucid-accent/40 sm:min-h-0">
              <p className="text-xs font-medium uppercase tracking-wider text-lucid-accent">Step 2</p>
              <h3 className="mt-1 text-xl font-bold text-lucid-white">Delegate</h3>
              <p className="mt-3 text-sm text-lucid-muted">
                Create and delegate your capsule with Anchor. Capsule PDA is derived from owner; delegate to Magicblock PER (TEE) for private monitoring.
              </p>
              <div className="how-it-works-code mt-6 min-h-[200px] flex-1 overflow-hidden rounded-xl border border-lucid-border/50 bg-[#0d1117] p-3 font-mono text-xs leading-relaxed sm:min-h-[180px]">
                <pre className="whitespace-pre-wrap break-words text-[11px] sm:text-xs">
                  <code>
                    <span className="text-slate-400">const tx = await program.methods</span>{'\n'}
                    <span className="text-slate-400">  .createCapsule(</span>{'\n'}
                    <span className="text-slate-400">    new BN(inactivityPeriodSeconds),</span>{'\n'}
                    <span className="text-slate-400">    intentDataBuffer</span>{'\n'}
                    <span className="text-slate-400">  )</span>{'\n'}
                    <span className="text-slate-400">  .accounts(</span>{'\n'}
                    <span className="text-cyan-300">    capsule</span>: capsulePDA,{'\n'}
                    <span className="text-cyan-300">    owner</span>: wallet.publicKey,{'\n'}
                    <span className="text-cyan-300">    systemProgram</span>: SystemProgram.programId{'\n'}
                    <span className="text-slate-400">  )</span>{'\n'}
                    <span className="text-slate-400">  .rpc()</span>
                  </code>
                </pre>
              </div>
              <Link href="/create" className="mt-4 text-sm font-medium text-lucid-accent hover:underline">
                View the code (lib/solana.ts) →
              </Link>
            </div>

            {/* STEP 3 Serve – dashboard preview */}
            <div data-gsap-step className="card-lucid flex min-h-[420px] flex-col overflow-hidden p-6 transition-all duration-300 hover:border-lucid-accent/40 sm:min-h-0">
              <p className="text-xs font-medium uppercase tracking-wider text-lucid-accent">Step 3</p>
              <h3 className="mt-1 text-xl font-bold text-lucid-white">Serve</h3>
              <p className="mt-3 text-sm text-lucid-muted">
                View and manage your capsules. Execution runs on Devnet when inactivity is met. No third party.
              </p>
              <div className="mt-6 min-h-[200px] flex-1 overflow-hidden rounded-xl border border-lucid-border/50 bg-lucid-card/80 sm:min-h-[180px]">
                <div className="relative h-full min-h-[180px] w-full">
                  <Image
                    src="/how-it-works-step3.png"
                    alt="Heres Capsules dashboard – status, PER (TEE) execution, verification"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
              </div>
              <Link href="/dashboard" className="mt-4 text-sm font-medium text-lucid-accent hover:underline">
                View the dashboard →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Unleash the Power of Heres - capsule image + project copy */}
      <section ref={unleashRef} className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div data-gsap-unleash-text className="max-w-xl">
              <h2 className="text-3xl font-bold leading-tight text-lucid-white sm:text-4xl lg:text-5xl">
                Unleash the Power of Heres
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-slate-300">
                Define your intent once: beneficiaries, amounts, inactivity period. Your capsule lives on Solana; Magicblock PER (TEE) monitors privately. When silence becomes truth, execution runs on Devnet. No third party, no bridges.
              </p>
              <Link href="/create" className="mt-8 inline-block rounded-xl bg-gradient-to-r from-lucid-cyan to-lucid-purple px-8 py-4 font-semibold text-lucid-bg shadow-glow-cyan transition-opacity hover:opacity-90">
                Create Your Capsule
              </Link>
            </div>
            <div
              data-gsap-unleash-3d
              data-poster-url="/lucid-capsule-hero.png"
              data-video-urls=""
              data-autoplay="true"
              data-loop="true"
              className="background-video w-background-video relative aspect-video max-w-lg overflow-hidden rounded-2xl border border-lucid-border/50 bg-lucid-surface/80 shadow-xl"
            >
              <CapsuleMediaBlock
                posterSrc="/lucid-capsule-hero.png"
                alt="Lucid capsule – privacy-preserving intent on Solana"
                objectFit="cover"
                withMotion
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Partners – The Possibilities Are Limitless + orbit + partner logos grid */}
      <section ref={partnersSectionRef} className="partners-section relative border-y border-lucid-border/30 bg-lucid-surface/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-lucid-white sm:text-4xl">
            The Possibilities Are Limitless, All On Solana
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lucid-muted">
            Lucid uses Solana for persistence, Magicblock PER (TEE) for private execution, Helius for RPC, Phantom and Backpack for wallets.
          </p>
        </div>
        <div className="partners-content relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="partners-orbit relative flex min-h-[420px] sm:min-h-[520px] items-center justify-center overflow-hidden">
            {/* Faint orbit paths – elliptical: wider left-right, shorter top-bottom */}
            <div className="partners-orbit-rings absolute inset-0 flex items-center justify-center" aria-hidden>
              <div className="absolute h-[320px] w-[480px] rounded-full border border-white/[0.06]" />
              <div className="absolute h-[440px] w-[660px] rounded-full border border-white/[0.06]" />
              <div className="absolute h-[560px] w-[840px] rounded-full border border-white/[0.06]" />
            </div>
            {/* Orbiting logos – elliptical path (radiusX > radiusY) + spin animation */}
            {[
              { radiusX: 240, radiusY: 160, count: 4, duration: 22, reverse: false },
              { radiusX: 330, radiusY: 220, count: 8, duration: 28, reverse: true },
              { radiusX: 420, radiusY: 280, count: 12, duration: 35, reverse: false },
            ].map((ring, ringIdx) => (
              <div
                key={ringIdx}
                className="partners-orbit-ring absolute left-1/2 top-1/2 h-0 w-0 origin-center"
                style={{
                  animation: `orbitSpin ${ring.duration}s linear infinite`,
                  animationDirection: ring.reverse ? 'reverse' : 'normal',
                } as React.CSSProperties}
              >
                {(() => {
                  const partners = [
                    { name: 'Solana', href: 'https://solana.com', color: '#9945FF', logo: '/logos/solana.svg' },
                    { name: 'Phantom', href: 'https://phantom.app', color: '#ab9ff2', logo: '/logos/phantom.svg' },
                    { name: 'Helius', href: 'https://helius.dev', color: '#f97316', logo: '/logos/helius.svg' },
                    { name: 'Backpack', href: 'https://backpack.app', color: '#E33E3F', logo: '/logos/backpack.svg' },
                    { name: 'Magicblock', href: 'https://www.magicblock.xyz', color: '#22d3ee', logo: '/logos/magicblock.svg' },
                  ]
                  const items = Array.from({ length: ring.count }, (_, i) => partners[i % partners.length])
                  return items.map((p, i) => {
                    const angleDeg = (360 / ring.count) * i
                    const angleRad = (angleDeg * Math.PI) / 180
                    const x = ring.radiusX * Math.sin(angleRad)
                    const y = -ring.radiusY * Math.cos(angleRad)
                    return (
                      <a
                        key={`${ringIdx}-${i}`}
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="partners-orbit-item absolute left-0 top-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-xl border bg-lucid-surface/80 backdrop-blur-sm transition-all hover:scale-110 hover:border-lucid-accent/50 hover:bg-lucid-card"
                        style={{
                          transform: `translate(${x}px, ${y}px) rotate(${-angleDeg}deg)`,
                          borderColor: `${p.color}50`,
                        }}
                      >
                        <Image
                          src={p.logo}
                          alt={p.name}
                          width={36}
                          height={36}
                          className="h-full w-full object-contain p-0.5"
                        />
                      </a>
                    )
                  })
                })()}
              </div>
            ))}
            {/* Central content – higher contrast font */}
            <div className="relative z-10 max-w-lg text-center">
              <h2 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                4+
              </h2>
              <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                Powered by
              </h3>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
