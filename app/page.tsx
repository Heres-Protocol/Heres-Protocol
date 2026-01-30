'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import dynamic from 'next/dynamic'
import { ArrowRight, Shield, Zap, Eye, Sparkles, Lock, ChevronDown, ChevronUp, Activity, Gavel, Quote, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import WorkflowDemo from '@/components/WorkflowDemo'
import { SequenceDiagram } from '@/components/SequenceDiagram'
import { ARCHITECTURE_COMPARISONS } from '@/constants/architecture'

// Dynamic import to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export default function Home() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const wallet = useWallet()
  const { publicKey, connected, disconnect, select, wallets } = wallet
  const [activeStep, setActiveStep] = useState(1)
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const [activeArchitectureStep, setActiveArchitectureStep] = useState<number | null>(null)
  const [dormantSeries, setDormantSeries] = useState<number[]>([])
  const [dormantLabels, setDormantLabels] = useState<string[]>([])
  const [dormantCount, setDormantCount] = useState<number>(0)
  const [estimatedAssetsUsd, setEstimatedAssetsUsd] = useState<number>(0)
  const [estimatedAssetsSol, setEstimatedAssetsSol] = useState<number>(0)
  const [dormantLoading, setDormantLoading] = useState(true)
  const [dormantError, setDormantError] = useState<string | null>(null)

  // Close wallet menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showWalletMenu && !target.closest('.wallet-menu-container')) {
        setShowWalletMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showWalletMenu])

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      heroTl.fromTo(
        '.gsap-hero',
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9 }
      ).fromTo(
        '.gsap-hero-sub',
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.08 },
        '-=0.5'
      )
      heroTl.timeScale(1.1)

      gsap.from('.gsap-card', {
        y: 30,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power2.out',
        delay: 0.2,
      })

      gsap.from('.gsap-step', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power2.out',
        delay: 0.4,
      })

      gsap.to('.gsap-orb', {
        y: -18,
        duration: 6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.6,
      })

      const chartLine = document.querySelector('.gsap-chart-line') as SVGPathElement | null
      const chartArea = document.querySelector('.gsap-chart-area') as SVGPathElement | null
      if (chartLine) {
        const length = chartLine.getTotalLength()
        gsap.set(chartLine, { strokeDasharray: length, strokeDashoffset: length })
        gsap.to(chartLine, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.out', delay: 0.4 })
      }
      if (chartArea) {
        gsap.fromTo(chartArea, { opacity: 0 }, { opacity: 1, duration: 1.1, delay: 0.6 })
      }

      gsap.from('.gsap-stat', {
        y: 16,
        opacity: 0,
        duration: 0.9,
        stagger: 0.15,
        ease: 'power2.out',
        delay: 0.7,
      })

      gsap.utils.toArray<HTMLElement>('.gsap-reveal').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 32, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
            },
          }
        )
      })

      gsap.utils.toArray<HTMLElement>('.gsap-reveal-stagger').forEach((wrap) => {
        const items = wrap.querySelectorAll('.gsap-reveal-item')
        gsap.fromTo(
          items,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: wrap,
              start: 'top 85%',
            },
          }
        )
      })
    }, rootRef)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadDormantStats = async () => {
      setDormantLoading(true)
      setDormantError(null)
      try {
        const response = await fetch('/api/dormant-wallets', { cache: 'no-store' })
        const data = await response.json()
        if (!isMounted) return
        if (!response.ok) {
          setDormantError(data?.error || 'Failed to load')
          setDormantSeries([])
          setDormantLabels([])
          return
        }
        if (Array.isArray(data.series)) setDormantSeries(data.series)
        if (Array.isArray(data.labels)) setDormantLabels(data.labels)
        if (typeof data.dormantCount === 'number') setDormantCount(data.dormantCount)
        if (typeof data.estimatedAssetsUsd === 'number') setEstimatedAssetsUsd(data.estimatedAssetsUsd)
        if (typeof data.estimatedAssetsSol === 'number') setEstimatedAssetsSol(data.estimatedAssetsSol)
      } catch (error) {
        if (isMounted) {
          setDormantError('Failed to load')
          setDormantSeries([])
          setDormantLabels([])
        }
        console.error('Failed to load dormant wallet stats:', error)
      } finally {
        if (isMounted) setDormantLoading(false)
      }
    }
    loadDormantStats()
    const interval = setInterval(loadDormantStats, 5 * 60 * 1000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const chartPath = useMemo(() => {
    const values = dormantSeries.length ? dormantSeries : [0]
    const width = 600
    const height = 220
    const top = 40
    const bottom = 200
    const min = Math.min(...values)
    const max = Math.max(...values, min + 1)
    const range = Math.max(max - min, 1)
    const stepX = values.length > 1 ? width / (values.length - 1) : width
    const points = values.map((value, index) => {
      const normalized = (value - min) / range
      const y = bottom - normalized * (bottom - top)
      const x = stepX * index
      return { x, y }
    })
    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ')
    const area = `${line} L ${width} ${height} L 0 ${height} Z`
    return { line, area }
  }, [dormantSeries])

  const formattedAssetsUsd = useMemo(() => {
    if (!estimatedAssetsUsd || estimatedAssetsUsd <= 0) return '~$0'
    const value = estimatedAssetsUsd >= 1e9
      ? `~$${(estimatedAssetsUsd / 1e9).toFixed(2)}B`
      : `~$${(estimatedAssetsUsd / 1e6).toFixed(2)}M`
    return value
  }, [estimatedAssetsUsd])

  const steps = [
    {
      step: 1,
      number: '01',
      title: 'Create Memory Capsule',
      description: 'Define your intent in natural language. Specify what should happen, when, and to whom.',
      icon: Sparkles,
    },
    {
      step: 2,
      number: '02',
      title: 'Set Trigger Conditions',
      description: 'Configure time-based, event-based, or social triggers. Set inactivity periods and guardian confirmations.',
      icon: Lock,
    },
    {
      step: 3,
      number: '03',
      title: 'Simulate Execution',
      description: 'Preview what happens if your capsule triggers today. See all possible outcomes and failure scenarios.',
      icon: Eye,
    },
    {
      step: 4,
      number: '04',
      title: 'Automatic Execution',
      description: 'When conditions are met, your intentions execute automatically on-chain. No manual intervention needed.',
      icon: Zap,
    },
  ]

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-gradient-to-b from-[#0f1629] via-[#162038] to-[#1a2540] relative overflow-hidden"
    >
      {/* 3D Hero Background - lighter overlay for brighter feel */}
      <div className="fixed inset-0 w-full h-full z-0">
        <div className="absolute inset-0 dream-bg opacity-70 z-[2]" />
        <div className="absolute inset-0 dream-glow opacity-60 z-[3]" />
        <div className="absolute inset-0 gsap-grid opacity-25 z-[4]" />
        <div className="absolute -top-24 -left-24 w-[520px] h-[520px] gsap-orb opacity-50 z-[5]" />
        <div className="absolute top-1/3 -right-32 w-[620px] h-[620px] gsap-orb opacity-35 z-[5]" />
        <div className="absolute inset-0 gsap-aurora opacity-35 z-[6]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1629]/20 via-[#162038]/15 to-[#1a2540]/20 z-[7]" />
        <div className="absolute left-12 top-24 w-24 h-24 dream-bubble z-[8] opacity-60" />
        <div className="absolute right-20 top-40 w-16 h-16 dream-bubble z-[8] opacity-60 [animation-duration:10s]" />
        <div className="absolute left-1/2 bottom-24 w-20 h-20 dream-bubble z-[8] opacity-60 [animation-duration:14s]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 gsap-nav">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-9 h-9 md:w-10 md:h-10 transition-transform group-hover:rotate-6">
              <Image
                src="/logo.png"
                alt="Lucid"
                fill
                className="object-contain drop-shadow-[0_8px_18px_rgba(255,255,255,0.25)]"
                priority
              />
            </div>
            <span className="sr-only">Lucid</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="relative z-[9999] wallet-menu-container">
            {connected && publicKey ? (
              <div className="relative">
                <button
                  onClick={() => setShowWalletMenu(!showWalletMenu)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors gsap-button"
                >
                  <span className="font-mono text-sm">
                    {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                  </span>
                  {showWalletMenu ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showWalletMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border border-[#00FF99]/25 overflow-hidden z-[10000] gsap-panel">
                    <button
                      onClick={async () => {
                        try {
                          await disconnect()
                          setShowWalletMenu(false)
                        } catch (err) {
                          console.error('Error disconnecting wallet:', err)
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-white hover:bg-[#0F1B2A] transition-colors"
                    >
                      Disconnect
                    </button>
                    {wallets && wallets.length > 1 && (
                      <>
                        <div className="border-t border-[#00FF99]/20"></div>
                        <div className="px-2 py-1 text-xs text-slate-400">Switch Wallet</div>
                        {wallets.map((w: any) => (
                          <button
                            key={w.adapter.name}
                            onClick={async () => {
                              try {
                                await select(w.adapter.name)
                                setShowWalletMenu(false)
                              } catch (err) {
                                console.error('Error switching wallet:', err)
                              }
                            }}
                            className="w-full text-left px-4 py-2 text-white hover:bg-[#0F1B2A] transition-colors"
                          >
                            {w.adapter.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
          <div className="material-elevation-2 rounded-lg overflow-hidden">
            <WalletMultiButton />
              </div>
            )}
            </div>
          </div>
        </div>
      </nav>

      {/* ========== HERO (Timeline Block 0) ========== */}
      <section className="relative pt-24 pb-8 px-6 min-h-screen flex items-center z-20">
        <div className="max-w-6xl mx-auto text-center relative z-20">
          <p className="gsap-hero text-xs uppercase tracking-[0.35em] text-[#A0ECFF] mb-4 font-medium">Intent Inheritance Protocol</p>
          <h1 className="gsap-hero text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-[#A0ECFF] via-[#C7B8FF] to-[#FFCEEA] bg-clip-text text-transparent leading-tight tracking-tight">
            People disappear.<br />Intent should not.
          </h1>
          <p className="gsap-hero-sub text-lg md:text-xl text-slate-100 mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
            Lucid allows you to securely record, simulate, and automatically execute your intentions on-chain when you are no longer able to act.
          </p>
          <div className="flex justify-center">
            <Link href="/dashboard">
              <button className="gsap-hero-sub material-button material-elevation-4 hover:material-elevation-8 px-10 py-4 rounded-xl font-semibold text-base flex items-center gap-2 mx-auto transition-all group gsap-button">
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== PARTNERS (Timeline Block) ========== */}
      <section className="relative pt-8 pb-16 px-6 z-20 overflow-hidden gsap-reveal">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-300 mb-6 text-center font-medium">Trusted Partners</p>
          <div className="relative rounded-3xl border-2 border-[#A0ECFF]/40 px-6 py-5 overflow-hidden bg-[#0c1222]/95 shadow-xl backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-[#A0ECFF]/15 via-[#C7B8FF]/08 to-[#FFCEEA]/15 rounded-3xl" />
            <div className="relative z-10 flex gap-12 animate-scroll-left">
              {[
                { name: 'Solana', src: '/logos/solana.png' },
                { name: 'Helius', src: '/logos/helius.png' },
                { name: 'Phantom', src: '/logos/phantom.png' },
                { name: 'Backpack', src: '/logos/backpack.png' },
                { name: 'Noir', src: '/logos/noir.png' },
                { name: 'Aztec', src: '/logos/aztec.png' },
              ].map((logo, index) => (
                <div key={`first-${index}`} className="flex-shrink-0 flex items-center justify-center opacity-95 hover:opacity-100 transition-opacity duration-300">
                  <div className="relative w-32 h-16 brightness-110 contrast-110">
                    <Image src={logo.src} alt={logo.name} fill className="object-contain" />
                  </div>
                </div>
              ))}
              {[
                { name: 'Solana', src: '/logos/solana.png' },
                { name: 'Helius', src: '/logos/helius.png' },
                { name: 'Phantom', src: '/logos/phantom.png' },
                { name: 'Backpack', src: '/logos/backpack.png' },
                { name: 'Noir', src: '/logos/noir.png' },
                { name: 'Aztec', src: '/logos/aztec.png' },
              ].map((logo, index) => (
                <div key={`second-${index}`} className="flex-shrink-0 flex items-center justify-center opacity-95 hover:opacity-100 transition-opacity duration-300">
                  <div className="relative w-32 h-16 brightness-110 contrast-110">
                    <Image src={logo.src} alt={logo.name} fill className="object-contain" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== TIMELINE BLOCK 1: On-Chain Data ========== */}
      <section className="relative py-20 md:py-28 px-6 z-20 gsap-reveal">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            <div className="lg:col-span-4 space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-[#A0ECFF] font-medium">On-Chain</p>
              <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
                Dormant Solana Wallets
              </h2>
              <p className="text-slate-100 leading-relaxed">
                On-chain sample from Lucid program wallets inactive 12+ months. Estimated assets locked in long-dormant wallets.
              </p>
            </div>
            <div className="lg:col-span-8 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-stretch">
              <div className="rounded-3xl border border-[#A0ECFF]/40 p-8 relative overflow-hidden bg-white/[0.12] backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-[#A0ECFF]/15 via-transparent to-[#FFCEEA]/10 rounded-3xl" />
                <div className="relative z-10">
                  <div className="flex justify-between mb-4">
                    <span className="text-xs uppercase tracking-widest text-slate-200">Last 12 Months</span>
                  </div>
                  <div className="relative h-56">
                    {dormantLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Loading on-chain data…</div>
                    ) : dormantError ? (
                      <div className="absolute inset-0 flex items-center justify-center text-rose-300 text-sm">{dormantError}</div>
                    ) : (
                      <>
                        <svg viewBox="0 0 600 220" className="w-full h-full">
                          <defs>
                            <linearGradient id="walletFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(160,236,255,0.45)" />
                              <stop offset="100%" stopColor="rgba(199,184,255,0.05)" />
                            </linearGradient>
                            <linearGradient id="walletStroke" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="rgba(160,236,255,1)" />
                              <stop offset="100%" stopColor="rgba(255,206,234,0.9)" />
                            </linearGradient>
                          </defs>
                          <path className="gsap-chart-area" d={chartPath.area} fill="url(#walletFill)" />
                          <path className="gsap-chart-line" d={chartPath.line} fill="none" stroke="url(#walletStroke)" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-x-0 bottom-2 flex justify-between text-[10px] text-slate-200 uppercase tracking-widest">
                          {dormantLabels.length > 0 ? dormantLabels.map((label, index) => (
                            <span key={`${label}-${index}`}>{label}</span>
                          )) : ['—', '—', '—', '—', '—', '—'].map((_, i) => <span key={i}>—</span>)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-[#C7B8FF]/45 p-8 flex flex-col justify-between bg-white/[0.1] backdrop-blur-xl">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-200">Estimated Assets</p>
                  {dormantLoading ? (
                    <p className="gsap-stat text-3xl md:text-4xl font-black text-white mt-2">…</p>
                  ) : dormantError ? (
                    <p className="gsap-stat text-lg font-semibold text-rose-300 mt-2">{dormantError}</p>
                  ) : (
                    <>
                      <p className="gsap-stat text-3xl md:text-4xl font-black text-white mt-2">{formattedAssetsUsd}</p>
                      <p className="text-slate-100 mt-4 text-sm">Total locked in long-dormant wallets</p>
                      <p className="text-xs text-slate-200 mt-1">≈ {estimatedAssetsSol.toFixed(2)} SOL</p>
                    </>
                  )}
                </div>
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-widest text-slate-200">Dormant Wallets</p>
                  {dormantLoading ? (
                    <p className="gsap-stat text-2xl md:text-3xl font-black text-white mt-2">…</p>
                  ) : dormantError ? (
                    <p className="gsap-stat text-lg font-semibold text-rose-300 mt-2">—</p>
                  ) : (
                    <p className="gsap-stat text-2xl md:text-3xl font-black text-white mt-2">{dormantCount.toLocaleString()}</p>
                  )}
                  <p className="text-slate-200 text-sm mt-2">No on-chain activity 12+ months</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TIMELINE BLOCK 2: Philosophy + Cards ========== */}
      <section className="relative py-20 md:py-28 px-6 z-20 gsap-reveal">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-xs uppercase tracking-[0.35em] text-[#C7B8FF] mb-4 font-medium">Philosophy</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
              Not About Assets.<br />About Decisions.
            </h2>
            <p className="text-lg md:text-xl text-slate-100 leading-relaxed">
              Lucid doesn&apos;t preserve assets. It preserves decisions, intent, and responsibility.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 gsap-reveal-stagger">
            {[
              { icon: Shield, title: 'Secure & Trustless', description: 'All intentions are stored on-chain with cryptographic guarantees. No intermediaries, no single point of failure.' },
              { icon: Zap, title: 'Automatic Execution', description: 'When conditions are met, your intentions execute automatically. No manual intervention required.' },
              { icon: Eye, title: 'Simulation Mode', description: 'Preview what happens if your capsule triggers today. Visual execution preview with failure scenarios.' },
            ].map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="gsap-card gsap-reveal-item p-8 group relative overflow-hidden transition-all duration-500 rounded-2xl border border-[#A0ECFF]/30 bg-white/[0.12] backdrop-blur-xl hover:bg-white/[0.18] hover:border-[#A0ECFF]/50 shadow-lg">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#A0ECFF]/0 to-[#C7B8FF]/0 group-hover:from-[#A0ECFF]/15 group-hover:to-[#FFCEEA]/12 transition-all duration-500 rounded-2xl" />
                  <div className="relative z-10">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#A0ECFF]/30 to-[#C7B8FF]/30 rounded-2xl flex items-center justify-center mb-5 group-hover:from-[#A0ECFF]/40 group-hover:to-[#FFCEEA]/35 transition-all">
                      <Icon className="w-7 h-7 text-[#A0ECFF]" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{feature.title}</h3>
                    <p className="text-sm text-slate-100 leading-[1.6]">{feature.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ========== TIMELINE BLOCK 3: How It Works + Demo Flow ========== */}
      <section className="relative py-20 md:py-28 px-6 z-20 gsap-reveal">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <p className="text-xs uppercase tracking-[0.35em] text-[#A0ECFF] mb-4 font-medium">How It Works</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
              Create Memory Capsules
            </h2>
            <p className="text-lg md:text-xl text-slate-100 max-w-2xl leading-relaxed">
              Define your intentions, conditions, and actions. See the demo flow below.
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-stretch gsap-reveal-stagger">
            <div className="relative order-2 lg:order-1 gsap-reveal-item lg:min-w-0 overflow-hidden flex flex-col">
              <div className="relative w-full min-h-[520px] flex-1 flex flex-col">
                <WorkflowDemo activeStep={activeStep} />
              </div>
            </div>
            <div className="relative z-[100] order-1 lg:order-2 gsap-reveal-item w-full lg:w-auto lg:min-w-[400px] lg:min-h-[520px] p-5 rounded-2xl border-2 border-[#A0ECFF]/50 shadow-2xl bg-[#0c1222] overflow-visible flex flex-col">
              <div className="flex flex-col gap-4 flex-1">
                {steps.map((item) => {
                  const Icon = item.icon
                  const isActive = activeStep === item.step
                  return (
                    <div
                      key={item.step}
                      className={`gsap-step p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 min-h-[100px] ${
                        isActive
                          ? 'border-[#A0ECFF] bg-[#A0ECFF]/20 shadow-lg shadow-[#A0ECFF]/25'
                          : 'border-[#A0ECFF]/40 bg-[#0f1629] hover:border-[#A0ECFF]/60 hover:bg-[#A0ECFF]/10'
                      }`}
                      onMouseEnter={() => setActiveStep(item.step)}
                      onClick={() => setActiveStep(item.step)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <span className={`text-xl font-black ${isActive ? 'text-[#A0ECFF]' : 'text-slate-200'}`}>
                            {item.number}
                          </span>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#A0ECFF]/30' : 'bg-[#A0ECFF]/10'}`}>
                            <Icon className={`w-4 h-4 ${isActive ? 'text-[#C7B8FF]' : 'text-slate-200'}`} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold mb-1 text-white leading-tight">{item.title}</h3>
                          <p className="text-sm leading-relaxed text-slate-100 line-clamp-2">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TIMELINE BLOCK 4: Architecture ========== */}
      <section className="relative py-20 md:py-28 px-6 z-20 gsap-reveal">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <p className="text-xs uppercase tracking-[0.35em] text-[#C7B8FF] mb-4 font-medium">Architecture</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
              Verifiable Silence
            </h2>
            <p className="text-lg md:text-xl text-slate-100 max-w-2xl leading-relaxed">
              Nothing happens on-chain until inactivity is proven via Noir ZK.
            </p>
          </div>

          {/* Side-by-Side Content Area - no dark section bg */}
          <div className="flex flex-col lg:flex-row gap-8 items-start mb-16">
            {/* Main Diagram Section (Left) */}
            <section className="w-full lg:w-[62%]">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#A0ECFF]/15 rounded-lg">
                    <Activity size={16} className="text-[#A0ECFF]" />
                  </div>
                  <h3 className="text-lg font-black tracking-tight uppercase text-white">Execution Pipeline</h3>
                </div>
                <div className="text-[9px] font-mono text-slate-200 tracking-widest uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A0ECFF] animate-pulse" />
                  Interactive Protocol
                </div>
              </div>

              <SequenceDiagram 
                activeStep={activeArchitectureStep} 
                onStepHover={setActiveArchitectureStep} 
              />
            </section>

            {/* Table Section (Right) */}
            <section className="w-full lg:w-[38%] sticky top-8 space-y-6">
              <div>
                <div className="mb-4 px-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">Protocol Milestones</h3>
                  <div className="h-0.5 w-12 bg-[#C7B8FF]/40 rounded-full" />
                </div>

                <div className="rounded-2xl overflow-hidden border-2 border-[#A0ECFF]/40 bg-[#0c1222]/95 backdrop-blur-sm shadow-lg transition-all mb-3">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#A0ECFF]/15 border-b border-[#A0ECFF]/30">
                        <th className="px-4 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-[#A0ECFF]">Lucid Sequence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#A0ECFF]/15">
                      {ARCHITECTURE_COMPARISONS.map((row, i) => {
                        const isHighlighted = activeArchitectureStep !== null && row.relatedStepIds?.includes(activeArchitectureStep)
                        return (
                          <tr 
                            key={i} 
                            className={`transition-all duration-500 group cursor-default relative
                              ${isHighlighted ? 'bg-[#A0ECFF]/20' : 'hover:bg-white/[0.08]'}
                            `}
                            onMouseEnter={() => {
                              if (row.relatedStepIds?.length) setActiveArchitectureStep(row.relatedStepIds[0])
                            }}
                            onMouseLeave={() => setActiveArchitectureStep(null)}
                          >
                            <td className="px-4 py-3 relative overflow-hidden">
                              {/* Highlight Indicator Bar */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-500 ${isHighlighted ? 'bg-[#A0ECFF] opacity-100 scale-y-100' : 'bg-[#A0ECFF]/0 opacity-0 scale-y-0'}`} />
                              
                              <div className="flex items-center gap-2.5">
                                <Zap size={11} className={`transition-all duration-500 ${isHighlighted ? 'text-[#A0ECFF] scale-125 glow-blue' : 'text-[#A0ECFF]/40 group-hover:text-[#A0ECFF]/70'}`} />
                                <span className={`text-[13px] font-bold transition-all duration-300 ${isHighlighted ? 'text-white translate-x-1' : 'text-slate-200 group-hover:text-white'}`}>
                                  {row.lucid}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="px-2 text-[10px] font-mono text-slate-200 leading-relaxed uppercase tracking-widest">
                  * Hover milestones to highlight steps
                </p>
              </div>

              {/* Role of Noir ZK Section */}
              <div className="rounded-2xl p-6 border-2 border-[#C7B8FF]/40 bg-[#0c1222]/95 backdrop-blur-sm shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Gavel size={80} className="text-[#C7B8FF]" />
                </div>
                
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <div className="p-1.5 bg-[#C7B8FF]/25 rounded-lg">
                    <Gavel size={16} className="text-[#C7B8FF]" />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">The Role of Noir ZK</h3>
                </div>

                <div className="space-y-4 relative z-10">
                  <p className="text-sm font-medium text-slate-100 leading-relaxed">
                    In Lucid, Noir acts as a <span className="text-[#C7B8FF] font-bold">Judge</span>, not a mediator.
                  </p>

                  <ul className="space-y-3">
                  {[
                    "Was there true silence?",
                    "Are conditions fully met?",
                    "Is execution still valid?"
                  ].map((q, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="mt-1">
                        <CheckCircle2 size={12} className="text-[#A0ECFF]" />
                      </div>
                      <span className="text-xs text-slate-200 italic font-light">"{q}"</span>
                    </li>
                  ))}
                </ul>

                  <div className="pt-4 border-t border-[#C7B8FF]/20">
                  <p className="text-[11px] text-slate-200 leading-relaxed">
                      Noir answers these questions with a binary <span className="text-white font-bold">Yes / No</span>, 
                    providing absolute verification <span className="text-[#C7B8FF]/90 underline decoration-[#C7B8FF]/40 underline-offset-4">without revealing any raw data</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Core Philosophy Caption */}
              <div className="rounded-2xl px-6 py-5 border-2 border-[#A0ECFF]/40 bg-[#0c1222]/90 backdrop-blur-sm relative group overflow-hidden text-center">
                <div className="absolute inset-0 bg-[#A0ECFF]/[0.06] group-hover:bg-[#C7B8FF]/[0.1] transition-colors rounded-2xl" />
                <Quote className="absolute -top-2 -left-2 text-[#A0ECFF]/20" size={40} />
                <p className="text-base md:text-lg font-light italic text-slate-100 relative z-10 leading-relaxed">
                  "Lucid replaces <span className="text-[#A0ECFF] font-bold">payment</span> with <span className="text-[#A0ECFF] font-bold">silence</span>,
                  and verifies it with <span className="text-white font-semibold">Noir ZK</span>."
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>

      {/* ========== TIMELINE BLOCK 5: CTA ========== */}
      <section className="relative py-20 md:py-28 px-6 z-20 gsap-reveal">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[#A0ECFF] mb-4 font-medium">Get Started</p>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
            Ready to Preserve Your Intent?
          </h2>
          <p className="text-lg md:text-xl text-slate-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create your first Memory Capsule and ensure your decisions live on, even when you can&apos;t.
          </p>
          <Link href="/dashboard">
            <button className="material-button material-elevation-4 hover:material-elevation-8 px-10 py-5 rounded-xl font-bold text-lg inline-flex items-center gap-3 transition-all group gsap-button">
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>
      </section>

      {/* Footer - 다크 네이비, 미니멀, 큰 Lucid 하단 짤림 */}
      <footer className="relative z-20 overflow-hidden bg-[#0c1222] border-t border-slate-700/40">
        <div className="relative max-w-7xl mx-auto px-6 pt-20 md:pt-28 pb-0 text-center">
          <p className="text-sm text-slate-500">
            © 2026 Lucid. All Rights Reserved.
          </p>
          {/* 큰 Lucid - 뮤트 그레이블루 + 은은한 텍스처, 하단 짤림 */}
          <div className="mt-12 md:mt-16 flex justify-center overflow-hidden" style={{ height: 'clamp(140px, 24vw, 220px)' }}>
            <span
              className="font-black tracking-tighter leading-none select-none whitespace-nowrap"
              style={{
                fontSize: 'clamp(4.5rem, 22vw, 15rem)',
                color: 'transparent',
                background: 'repeating-linear-gradient(105deg, rgba(148,163,184,0.5) 0px, rgba(148,163,184,0.5) 1px, rgba(100,116,139,0.6) 1px, rgba(100,116,139,0.6) 3px)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              Lucid
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
