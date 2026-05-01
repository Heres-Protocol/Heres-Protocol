'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRef, useEffect, useState } from 'react'
import { getAppHref } from '@/lib/app-url'

const AsciiCapsule = dynamic(() => import('@/components/AsciiCapsule').then((m) => ({ default: m.AsciiCapsule })), {
  ssr: false,
  loading: () => <div className="min-h-[120px]" aria-hidden />,
})

const HeroCapsuleVideo = dynamic(() => import('@/components/HeroCapsuleVideo').then((m) => ({ default: m.HeroCapsuleVideo })), {
  ssr: false,
  loading: () => <div className="aspect-video w-full animate-pulse rounded-2xl bg-Heres-surface/50" aria-hidden />,
})


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
          className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-Heres-accent rounded-full"
          aria-hidden
          style={{ height }}
        />
      )}
      {active && !filled && (
        <div
          className="why-flow-segment absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 bg-Heres-accent rounded-full"
          aria-hidden
        />
      )}
    </div>
  )
}

const features: any[] = []

const quickStartCards = [
  {
    title: 'Create Capsule',
    desc: 'Define beneficiary wallets, allocation, and inactivity period in under 2 minutes.',
    href: getAppHref('/create'),
    cta: 'Start Creating',
  },
  {
    title: 'Track Activity',
    desc: 'Watch wallet-level activity signals and capsule status from a single dashboard.',
    href: getAppHref('/dashboard'),
    cta: 'Open Dashboard',
  },
  {
    title: 'Mobile Demo',
    desc: 'Run the Seeker-native flow and sign extension actions directly from Android.',
    href: 'https://seeker.solanamobile.com',
    cta: 'Download APK',
    external: true,
  },
]

const proofMetrics = [
  { label: 'Chains', value: 'Solana-first' },
  { label: 'Execution', value: 'Permissionless' },
  { label: 'Privacy', value: 'PER (TEE)' },
  { label: 'Runtime', value: 'Automatic' },
]

/* Why Heres benefit-focused cards */
const whyHeresCards = [
  {
    title: 'Your intent, executed when it matters',
    description: 'Leave instructions that run only when the time is right. No one can execute early. Your conditions stay yours until the moment you chose.',
    image: '/why-Heres-1.png',
    href: getAppHref('/create'),
  },
  {
    title: 'Privacy by design',
    description: 'Your conditions stay private. Only the outcome is visible on-chain. No third party sees your rules. Just the result when silence becomes truth.',
    image: '/why-Heres-2.png',
    href: getAppHref('/dashboard'),
  },
  {
    title: "Set it once. It runs when you're silent.",
    description: 'Define your intent once. No bridges, no middlemen. When your conditions are met, execution happens automatically, the way you wanted.',
    image: '/why-Heres-3.png',
    href: getAppHref('/create'),
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
  const gsapCtxRef = useRef<{ revert?: () => void } | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const gsap = (await import('gsap')).default
      const ScrollTrigger = (await import('gsap/ScrollTrigger')).default
      gsap.registerPlugin(ScrollTrigger)
      if (cancelled) return
      gsapCtxRef.current = gsap.context(() => {
        gsap.from(heroRef.current?.querySelector('[data-hero-tag]') ?? {}, {
          opacity: 0,
          y: 20,
          duration: 0.6,
          ease: 'power3.out',
        })
        gsap.from(heroRef.current?.querySelector('h1') ?? {}, {
          opacity: 0,
          y: 40,
          duration: 0.8,
          delay: 0.15,
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
    })()
    return () => {
      cancelled = true
      if (gsapCtxRef.current?.revert) gsapCtxRef.current.revert()
      gsapCtxRef.current = null
    }
  }, [])

  return (
    <div className="bg-hero grain-overlay">
      <section
        ref={heroRef}
        className="relative overflow-hidden px-4 pb-20 pt-36 sm:px-6 sm:pb-28 sm:pt-44 lg:px-8"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1120px] overflow-hidden" aria-hidden>
          <div className="absolute left-1/2 top-8 h-[980px] w-[980px] -translate-x-1/2 rounded-[48%] border border-cyan-400/25 bg-[radial-gradient(circle_at_40%_40%,rgba(30,196,255,0.38),rgba(5,10,24,0.08)_45%,transparent_72%)] blur-[2px]" />
          <div className="absolute left-1/2 top-20 h-[920px] w-[920px] -translate-x-1/2 rounded-[46%] border border-cyan-400/15 shadow-[0_0_80px_rgba(34,211,238,0.2),0_0_180px_rgba(37,99,235,0.18)]" />
          <div className="absolute -left-20 bottom-0 h-[520px] w-[520px] rounded-full bg-blue-700/40 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl text-center">
          <h1 className="mx-auto max-w-5xl text-[clamp(3.4rem,8vw,6.6rem)] font-semibold uppercase leading-[0.94] tracking-[-0.06em] text-white">
            <span className="text-cyan-400">Your intent.</span> Executed when
            <br />
            you&apos;re silent
          </h1>
          <div className="mt-10">
            <Link
              href={getAppHref('/create')}
              className="inline-flex min-w-[390px] max-w-full items-center justify-center rounded-[22px] bg-[#30b6d1] px-10 py-5 text-[22px] font-semibold uppercase tracking-[-0.03em] text-white shadow-[0_0_30px_rgba(34,211,238,0.4)] transition hover:opacity-90"
            >
              Create Capsules
            </Link>
          </div>
          <p className="mx-auto mt-14 max-w-5xl text-[clamp(1.35rem,2.2vw,2rem)] font-semibold leading-[1.35] text-white/45">
            Create once, then let Heres monitor silently. When inactivity conditions are met, execution
            finalizes on Solana without manual intervention.
          </p>
          <div className="mt-16">
            <p className="text-[22px] uppercase tracking-[-0.03em] text-white">Built On</p>
            <div className="mx-auto mt-6 inline-flex rounded-[2px] bg-black px-12 py-6">
              <Image src="/logos/solana.svg" alt="Solana" width={250} height={60} className="h-10 w-auto" unoptimized />
            </div>
          </div>
          <div className="mt-24">
            <p className="text-[22px] uppercase tracking-[-0.03em] text-white">Backed By</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
              {['COLOSSEUM', 'MagicBlock', 'COLOSSEUM', 'MagicBlock', 'COLOSSEUM'].map((name, index) => (
                <div key={`${name}-${index}`} className="flex h-[64px] items-center justify-center bg-black/80 px-6 text-2xl font-semibold text-white/90">
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[radial-gradient(circle_at_40%_0%,rgba(29,78,216,0.55),transparent_38%),linear-gradient(180deg,#11205f_0%,#0e1a55_100%)] py-14 sm:py-16">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {quickStartCards.map((card) => (
              <div key={card.title} className="mx-auto w-full max-w-[460px] rounded-[28px] border border-cyan-400/45 bg-[#12183a] px-6 py-10 text-center shadow-[0_0_0_1px_rgba(34,211,238,0.05)]">
                <h3 className="font-display text-[42px] font-semibold uppercase tracking-[-0.05em] text-Heres-white">{card.title}</h3>
                <p className="mt-4 text-[18px] leading-[1.45] text-white/45">{card.desc}</p>
                <Link
                  href={card.href}
                  target={card.external ? '_blank' : undefined}
                  rel={card.external ? 'noopener noreferrer' : undefined}
                  className="mt-7 inline-flex items-center gap-3 text-[20px] font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
                >
                  {card.cta}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-8 max-w-[460px] rounded-[28px] border border-cyan-400/45 bg-[#12183a] px-6 py-10 text-center shadow-[0_0_0_1px_rgba(34,211,238,0.05)]">
            <h3 className="font-display text-[42px] font-semibold uppercase tracking-[-0.05em] text-Heres-white">Mobile Demo</h3>
            <p className="mt-4 text-[18px] leading-[1.45] text-white/45">
              Run the seeker-native flow and sign extension actions directly from your Mobile.
            </p>
            <Link href="https://seeker.solanamobile.com" target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-3 text-[20px] font-semibold text-cyan-400 transition-colors hover:text-cyan-300">
              Download APK
            </Link>
          </div>
        </div>
      </section>

      {/* Why Build With Heres */}
      <section ref={whySectionRef} className="why-build-section py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-[28px] bg-[#12183a] px-8 py-9 text-center">
            <h2 ref={whyTitleRef} className="font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl lg:text-5xl">
              Why Build With Heres?
            </h2>
            <p className="why-build-subtitle text-lg font-medium font-display uppercase tracking-wide">Your development environment</p>
            <p className="why-build-desc mt-2">Everything you need to build privacy-preserving capsules on Solana.</p>
          </div>

          <div className="mt-20 grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
            {/* Left: Why Heres steps */}
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
                    className={`flex cursor-pointer flex-col py-6 transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                  >
                    <div
                      className={`relative flex items-start transition-all duration-500 ${isActive ? 'pl-5' : 'pl-0'}`}
                      style={{
                        borderLeft: isActive ? '2px solid rgba(34, 211, 238, 0.4)' : '2px solid transparent',
                      }}
                    >
                      {isActive && (
                        <div
                          key={`step-bar-${i}`}
                          className="why-build-step-bar absolute left-0 top-0 w-0.5 bg-Heres-accent"
                          aria-hidden
                          onAnimationEnd={() => setActiveWhyIndex((prev) => (prev + 1) % whyHeresCards.length)}
                        />
                      )}
                      <div>
                        <div className="mb-2 font-display text-xs font-medium uppercase tracking-widest text-Heres-accent/60">
                          Step {i + 1}
                        </div>
                        <h3 className="mb-3 font-display text-xl font-bold uppercase tracking-tight text-white">
                          {card.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-white/50">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Right: Heres flow diagram */}
            <div ref={whyVisualMainRef} className="relative w-full md:min-w-0 md:flex-1 lg:max-w-[900px]">
              <div className="why-build-flow-wrap relative flex flex-col md:flex-row md:items-stretch md:gap-0 md:pl-2 md:pr-4">
                <div className="relative mt-4 flex w-full flex-col items-center text-white md:mt-0 md:w-full md:scale-100">
                  {/* 1. Solana Devnet */}
                  <div
                    className="z-10 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transform: activeWhyIndex >= 0 ? 'scale(1)' : 'scale(0.98)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-3 text-center md:p-4 w-[164px]">
                      <div className="flex items-center justify-center gap-2 font-display text-sm md:text-base text-white whitespace-nowrap uppercase tracking-wide">
                        <Image src="/logos/solana.svg" alt="Solana" width={24} height={24} className="h-6 w-auto shrink-0" unoptimized />
                        <span>Solana Devnet</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative flex justify-center" style={{ opacity: 1 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2 50" width={2} height={50} className="shrink-0 text-white">
                      <path stroke="currentColor" strokeDasharray="5 5" strokeLinecap="square" strokeOpacity={0.5} strokeWidth={1.5} d="M1 1v48" />
                    </svg>
                    {activeWhyIndex > 0 && (
                      <div className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-Heres-accent rounded-full" aria-hidden style={{ height: 50 }} />
                    )}
                    {activeWhyIndex === 0 && (
                      <div className="why-flow-segment absolute left-1/2 h-6 w-[1.5px] -translate-x-1/2 rounded-full bg-Heres-accent" aria-hidden style={{ top: 0 }} />
                    )}
                  </div>
                  {/* 2. Heres Capsules */}
                  <div
                    className="z-10 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transform: activeWhyIndex >= 0 ? 'scale(1)' : 'scale(0.98)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="rounded-xl w-[164px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-3 text-center md:p-4">
                      <div className="font-display text-sm md:text-base text-white uppercase tracking-wide">Heres Capsules</div>
                    </div>
                  </div>
                  {/* Parallel dashed lines */}
                  <div className="relative -z-10 flex w-full justify-center gap-2 md:gap-6" style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transition: 'opacity 0.3s' }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="relative flex justify-center" style={{ opacity: 1 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2 30" width={2} height={30} className="shrink-0 text-white">
                          <path stroke="currentColor" strokeDasharray="5 5" strokeLinecap="square" strokeOpacity={0.5} strokeWidth={1.5} d="M1 1v28" />
                        </svg>
                        {activeWhyIndex > 1 && <div className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-Heres-accent rounded-full" style={{ height: 30 }} aria-hidden />}
                      </div>
                    ))}
                  </div>
                  {/* Tokens or NFTs */}
                  <div
                    className="z-20 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transform: activeWhyIndex >= 0 ? 'scale(1)' : 'scale(0.95)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="rounded-lg w-[140px] whitespace-nowrap border border-white/[0.08] bg-white/[0.03] px-1.5 py-1 text-center font-display text-[11px] uppercase leading-none tracking-wider text-white/50">
                      Tokens or NFTs
                    </div>
                  </div>
                  {/* Parallel dashed lines again */}
                  <div className="relative -z-10 flex w-full justify-center gap-2 md:gap-6" style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transition: 'opacity 0.3s' }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="relative flex justify-center" style={{ opacity: 1 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2 30" width={2} height={30} className="shrink-0 text-white">
                          <path stroke="currentColor" strokeDasharray="5 5" strokeLinecap="square" strokeOpacity={0.5} strokeWidth={1.5} d="M1 1v28" />
                        </svg>
                        {activeWhyIndex > 1 && <div className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-Heres-accent rounded-full" style={{ height: 30 }} aria-hidden />}
                      </div>
                    ))}
                  </div>
                  {/* 3. Magicblock PER (TEE) */}
                  <div
                    className="relative z-20 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 1 ? 1 : 0.4, transform: activeWhyIndex >= 1 ? 'scale(1)' : 'scale(0.95)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-3 py-2 leading-none md:px-4 md:py-2.5 min-w-[220px] w-[220px]">
                      <div className="flex items-center gap-2 justify-center whitespace-nowrap">
                        <Image src="/logos/magicblock.svg" alt="Magicblock" width={20} height={20} className="h-5 w-auto shrink-0" unoptimized />
                        <span className="font-display text-[11px] uppercase tracking-wider text-white/60">Magicblock PER (TEE)</span>
                      </div>
                      <span className="font-display text-[9px] uppercase tracking-widest text-white/30">Privacy</span>
                    </div>
                  </div>
                  <div className="relative flex justify-center">
                    <DashedLine height={30} segmentIndex={2} activeWhyIndex={activeWhyIndex} />
                  </div>
                  {/* 4. Monitoring */}
                  <div
                    className="z-10 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 1 ? 1 : 0.4, transform: activeWhyIndex >= 1 ? 'scale(1)' : 'scale(0.98)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-3 py-2 leading-none md:px-4 md:py-2.5 w-[164px]">
                      <div className="flex items-center gap-2 justify-center leading-none">
                        <Image src="/logos/helius.svg" alt="Helius" width={18} height={18} className="shrink-0" unoptimized />
                        <span className="font-display text-[11px] uppercase tracking-wider text-white/60">Monitoring</span>
                      </div>
                      <span className="font-display text-[10px] uppercase tracking-wider text-white/40 leading-none">Helius RPC</span>
                    </div>
                  </div>
                  <div className="relative flex justify-center">
                    <DashedLine height={28} segmentIndex={2} activeWhyIndex={activeWhyIndex} />
                  </div>
                  {/* 5. Execution */}
                  <div
                    className="z-10 flex w-full justify-center"
                    style={{ opacity: activeWhyIndex >= 0 ? 1 : 0.4, transform: activeWhyIndex >= 0 ? 'scale(1)' : 'scale(0.98)', transition: 'opacity 0.3s, transform 0.3s' }}
                  >
                    <div className="relative overflow-hidden rounded-xl border border-Heres-accent/20 bg-white/[0.03] backdrop-blur-sm p-3.5 text-center w-[220px] min-w-[220px]">
                      <div
                        className="absolute inset-0 rounded-xl bg-Heres-accent/20 transition-all duration-700 ease-out"
                        style={{ width: `${((activeWhyIndex + 1) / 3) * 100}%` }}
                        aria-hidden
                      />
                      <div className="relative z-10">
                        <div className="font-display text-sm font-bold uppercase tracking-wide text-white">Execution</div>
                        <div className="mt-1.5 whitespace-nowrap font-display text-[10px] uppercase tracking-widest text-white/50">Auto execute to Devnet</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* How it works - Bento Grid */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 ref={howTitleRef} className="font-display text-3xl font-bold uppercase tracking-tight text-Heres-white sm:text-4xl lg:text-5xl">
              How It Works
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-Heres-muted leading-relaxed">
              With Heres, define your intent once on Solana. Magicblock PER (TEE) monitors privately; execution runs on Devnet when conditions are met.
            </p>
          </div>

          {/* Bento grid layout */}
          <div ref={stepsRef} className="mt-16 grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto] lg:items-stretch">
            {/* STEP 1 Create - tall card */}
            <div data-gsap-step className="card-bento group flex flex-col p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-Heres-accent/10 font-display text-sm font-bold text-Heres-accent">01</span>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-Heres-white">Create</h3>
              </div>
              <p className="text-sm text-Heres-muted leading-relaxed">
                Create a capsule to define beneficiaries, amounts, and inactivity period on Solana Devnet.
              </p>
              <div className="mt-6 flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                <div className="relative h-full min-h-[200px] w-full">
                  <Image
                    src="/how-it-works-step1.png"
                    alt="Create Capsule - intent, beneficiaries, asset type"
                    fill
                    className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    unoptimized
                  />
                </div>
              </div>
              <Link href={getAppHref('/create')} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-Heres-accent/80 transition-colors hover:text-Heres-accent">
                View the create page
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>

            {/* STEP 2 Delegate - code card */}
            <div data-gsap-step className="card-bento group flex flex-col p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-Heres-purple/10 font-display text-sm font-bold text-Heres-purple">02</span>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-Heres-white">Delegate</h3>
              </div>
              <p className="text-sm text-Heres-muted leading-relaxed">
                Create and delegate your capsule with Anchor. Capsule PDA is derived from owner; delegate to Magicblock PER (TEE) for private monitoring.
              </p>
              <div className="mt-6 flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0d14] p-4 font-mono text-xs leading-relaxed">
                <pre className="whitespace-pre-wrap break-words text-[11px] sm:text-xs">
                  <code>
                    <span className="text-Heres-muted">const tx = await program.methods</span>{'\n'}
                    <span className="text-Heres-muted">  .createCapsule(</span>{'\n'}
                    <span className="text-Heres-muted">    new BN(inactivityPeriodSeconds),</span>{'\n'}
                    <span className="text-Heres-muted">    intentDataBuffer</span>{'\n'}
                    <span className="text-Heres-muted">  )</span>{'\n'}
                    <span className="text-Heres-muted">  .accounts(</span>{'\n'}
                    <span className="text-Heres-cyan">    capsule</span>: capsulePDA,{'\n'}
                    <span className="text-Heres-cyan">    owner</span>: wallet.publicKey,{'\n'}
                    <span className="text-Heres-cyan">    systemProgram</span>: SystemProgram.programId{'\n'}
                    <span className="text-Heres-muted">  )</span>{'\n'}
                    <span className="text-Heres-muted">  .rpc()</span>
                  </code>
                </pre>
              </div>
              <Link href={getAppHref('/create')} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-Heres-accent/80 transition-colors hover:text-Heres-accent">
                View the code
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>

            {/* STEP 3 Serve */}
            <div data-gsap-step className="card-bento group flex flex-col p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-Heres-accent/10 font-display text-sm font-bold text-Heres-accent">03</span>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-Heres-white">Serve</h3>
              </div>
              <p className="text-sm text-Heres-muted leading-relaxed">
                View and manage your capsules. Execution runs on Devnet when inactivity is met. No third party.
              </p>
              <div className="mt-6 flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                <div className="relative h-full min-h-[200px] w-full">
                  <Image
                    src="/how-it-works-step3.png"
                    alt="Heres Capsules dashboard - status, PER (TEE) execution, verification"
                    fill
                    className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    unoptimized
                  />
                </div>
              </div>
              <Link href={getAppHref('/dashboard')} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-Heres-accent/80 transition-colors hover:text-Heres-accent">
                View the dashboard
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="glow-line" />

      <section className="relative py-24 sm:py-32 overflow-hidden">
        {/* Background accent */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-Heres-purple/[0.02] to-transparent" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            {/* Left: Image */}
            <div className="flex flex-col items-center justify-center order-2 lg:order-1">
              <div className="relative w-full max-w-xl lg:max-w-2xl rounded-2xl overflow-hidden border border-white/[0.06] shadow-bento">
                <Image
                  src="/solana-mobile-hero.png"
                  alt="Heres - web dashboard and mobile Create Capsule"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                  sizes="(max-width: 768px) 100vw, 60vw"
                  unoptimized
                />
              </div>
            </div>
            {/* Right: Copy */}
            <div className="order-1 lg:order-2">
              <span className="tag-pill mb-6">
                <span className="accent-dot" />
                Solana Mobile Seeker
              </span>
              <h2 className="font-display text-3xl font-bold uppercase tracking-tight leading-tight text-Heres-white sm:text-4xl lg:text-5xl">
                Set it once.{' '}
                <span className="text-shimmer">It runs forever.</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-Heres-muted">
                Download the APK, tap a few times, and leave a will-like intent: who gets your assets and after how long of inactivity. Your capsule lives on Solana. Delete the app tomorrow. Execution still runs and distributes to your beneficiaries.
              </p>
              <p className="mt-4 text-base leading-relaxed text-white/30">
                The future is uncertain. Set your capsule while you hold the keys.
              </p>
              <Link
                href="https://seeker.solanamobile.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 btn-secondary rounded-full py-3.5"
              >
                Download APK
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-cyan-400/20 bg-[linear-gradient(180deg,#111d61_0%,#101a52_100%)] py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-[clamp(3rem,6vw,5rem)] font-semibold uppercase tracking-[-0.06em] text-white">The possibilities are limitless</h2>
          <p className="mt-4 text-3xl font-semibold uppercase tracking-[-0.04em] text-cyan-400">All on Solana</p>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-7xl font-semibold text-white/80">100 +</p>
              <p className="mt-4 text-2xl text-white/60">Capsules Created</p>
            </div>
            <div>
              <p className="text-7xl font-semibold text-white/80">100 <span className="text-5xl">SOL</span></p>
              <p className="mt-4 text-2xl text-white/60">Value Secured</p>
            </div>
            <div>
              <p className="text-7xl font-semibold text-white/80">10 +</p>
              <p className="mt-4 text-2xl text-white/60">Beneficiaries</p>
            </div>
          </div>
          <Link href={getAppHref('/create')} className="mt-16 inline-flex min-w-[390px] max-w-full items-center justify-center rounded-[22px] bg-[#30b6d1] px-10 py-5 text-[22px] font-semibold uppercase tracking-[-0.03em] text-white shadow-[0_0_30px_rgba(34,211,238,0.4)] transition hover:opacity-90">
            Create Capsules
          </Link>
          <p className="mt-14 text-[clamp(1.6rem,3vw,2.3rem)] font-semibold uppercase tracking-[-0.05em] text-white/45">
            Your comprehensive digital inheritance vault built on <span className="text-cyan-400">Solana.</span>
          </p>
        </div>
      </section>
    </div>
  )
}
