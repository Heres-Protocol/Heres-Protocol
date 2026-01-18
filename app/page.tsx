'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import dynamic from 'next/dynamic'
import { ArrowRight, Shield, Zap, Eye, Sparkles, Lock, CheckCircle, ChevronDown, ChevronUp, Activity, Gavel, Quote, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import Hero3D from '@/components/Hero3D'
import WorkflowDemo from '@/components/WorkflowDemo'
import { SequenceDiagram } from '@/components/SequenceDiagram'
import { ARCHITECTURE_COMPARISONS } from '@/constants/architecture'

// Dynamic import to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export default function Home() {
  const wallet = useWallet()
  const { publicKey, connected, disconnect, select, wallets } = wallet
  const [activeStep, setActiveStep] = useState(1)
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const [activeArchitectureStep, setActiveArchitectureStep] = useState<number | null>(null)

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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* 3D Hero Background */}
      <div className="fixed inset-0 w-full h-full z-0">
        <Hero3D />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 z-10"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-10 h-10 transition-transform group-hover:rotate-12">
              <Image
                src="/logo.svg"
                alt="Lucid Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
              Lucid
            </span>
          </Link>
          <div className="relative z-[9999] wallet-menu-container">
            {connected && publicKey ? (
              <div className="relative">
                <button
                  onClick={() => setShowWalletMenu(!showWalletMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
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
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden z-[10000]">
                    <button
                      onClick={async () => {
                        try {
                          await disconnect()
                          setShowWalletMenu(false)
                        } catch (err) {
                          console.error('Error disconnecting wallet:', err)
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors"
                    >
                      Disconnect
                    </button>
                    {wallets && wallets.length > 1 && (
                      <>
                        <div className="border-t border-slate-700"></div>
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
                            className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors"
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
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-8 px-6 min-h-screen flex items-center z-20">
        <div className="max-w-6xl mx-auto text-center relative z-20">
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent leading-tight tracking-tight">
              Intent Inheritance Protocol
            </h1>
            <p className="text-2xl md:text-3xl text-slate-300 mb-4 leading-relaxed font-light">
              People disappear. Intent should not.
            </p>
            <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
              Lucid allows you to securely record, simulate, and automatically execute your intentions on-chain when you are no longer able to act.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create">
                <button className="material-button material-elevation-4 hover:material-elevation-8 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold text-base flex items-center gap-2 mx-auto transition-all shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 group">
                  Create Memory Capsule
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link href="/capsules">
                <button className="material-button material-elevation-2 hover:material-elevation-4 px-8 py-4 bg-slate-800/60 hover:bg-slate-700/60 backdrop-blur-xl text-white rounded-xl font-semibold text-base border border-slate-700/50 hover:border-blue-500/50 transition-all">
                  View My Capsules
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Partners Section - Infinite Scroll */}
      <section className="relative pt-8 pb-12 px-6 z-20 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 text-center">
            <p className="text-sm text-slate-400 uppercase tracking-wider">Trusted Partners</p>
          </div>
          <div className="relative">
            {/* Scrolling container */}
            <div className="flex gap-12 animate-scroll-left">
              {/* First set of logos */}
              {[
                { name: 'Solana', src: '/logos/solana.png' },
                { name: 'Helius', src: '/logos/helius.png' },
                { name: 'Phantom', src: '/logos/phantom.png' },
                { name: 'Backpack', src: '/logos/backpack.png' },
                { name: 'Noir', src: '/logos/noir.png' },
                { name: 'Aztec', src: '/logos/aztec.png' },
              ].map((logo, index) => (
                <div
                  key={`first-${index}`}
                  className="flex-shrink-0 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity duration-300"
                >
                  <div className="relative w-32 h-16 grayscale hover:grayscale-0 transition-all duration-300">
                    <Image
                      src={logo.src}
                      alt={logo.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              ))}
              {/* Duplicate set for seamless loop */}
              {[
                { name: 'Solana', src: '/logos/solana.png' },
                { name: 'Helius', src: '/logos/helius.png' },
                { name: 'Phantom', src: '/logos/phantom.png' },
                { name: 'Backpack', src: '/logos/backpack.png' },
                { name: 'Noir', src: '/logos/noir.png' },
                { name: 'Aztec', src: '/logos/aztec.png' },
              ].map((logo, index) => (
                <div
                  key={`second-${index}`}
                  className="flex-shrink-0 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity duration-300"
                >
                  <div className="relative w-32 h-16 grayscale hover:grayscale-0 transition-all duration-300">
                    <Image
                      src={logo.src}
                      alt={logo.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24 px-6 z-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Not About Assets.<br />About Decisions.
            </h2>
            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto">
              Lucid doesn&apos;t preserve assets. It preserves decisions, intent, and responsibility.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Secure & Trustless',
                description: 'All intentions are stored on-chain with cryptographic guarantees. No intermediaries, no single point of failure.',
              },
              {
                icon: Zap,
                title: 'Automatic Execution',
                description: 'When conditions are met, your intentions execute automatically. No manual intervention required.',
              },
              {
                icon: Eye,
                title: 'Simulation Mode',
                description: 'Preview what happens if your capsule triggers today. Visual execution preview with failure scenarios.',
              },
            ].map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="material-card material-elevation-2 hover:material-elevation-8 p-8 group relative overflow-hidden transition-all duration-500"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/5 transition-all duration-500"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all material-elevation-4">
                      <Icon className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-slate-300 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative py-24 px-6 bg-slate-900/50 backdrop-blur-sm z-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">How It Works</h2>
            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto">
              Create Memory Capsules that define your intentions, conditions, and actions
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left side - Workflow Demo */}
            <div className="relative order-2 lg:order-1">
              <div className="relative w-full min-h-[600px]">
                <WorkflowDemo activeStep={activeStep} />
              </div>
            </div>

            {/* Right side - Text Steps */}
            <div className="space-y-6 order-1 lg:order-2">
              {steps.map((item) => {
                const Icon = item.icon
                const isActive = activeStep === item.step
                return (
                  <div
                    key={item.step}
                    className={`material-card material-elevation-${isActive ? '4' : '1'} hover:material-elevation-4 p-6 group relative overflow-hidden cursor-pointer transition-all duration-300 ${
                      isActive ? 'border-2 border-blue-500/50' : ''
                    }`}
                    onMouseEnter={() => setActiveStep(item.step)}
                    onClick={() => setActiveStep(item.step)}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r transition-all duration-300 ${
                      isActive 
                        ? 'from-blue-500/10 to-cyan-500/5' 
                        : 'from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/5 group-hover:to-cyan-500/0'
                    }`}></div>
                    <div className="relative z-10 flex items-start gap-6">
                      <div className="flex-shrink-0">
                        <div className={`text-3xl font-black step-number relative leading-none transition-all ${
                          isActive ? 'text-blue-400 scale-105' : 'text-slate-500'
                        }`}>
                          {item.number}
                          {isActive && (
                            <div className="absolute inset-0 bg-blue-500/30 blur-xl opacity-100 transition-opacity"></div>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 pt-1">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all material-elevation-2 ${
                          isActive 
                            ? 'bg-blue-500/30 scale-105' 
                            : 'bg-blue-500/10 group-hover:bg-blue-500/20'
                        }`}>
                          <Icon className={`w-6 h-6 transition-colors ${
                            isActive ? 'text-blue-400' : 'text-slate-400'
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-xl font-bold mb-2 transition-colors ${
                          isActive ? 'text-white' : 'text-slate-300'
                        }`}>
                          {item.title}
                        </h3>
                        <p className={`text-sm leading-relaxed transition-colors ${
                          isActive ? 'text-slate-200' : 'text-slate-400'
                        }`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="relative py-24 px-6 z-20 bg-slate-950/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Architecture</h2>
            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto">
              The architecture of verifiable silence. Nothing happens on-chain until inactivity is proven via Noir ZK.
            </p>
          </div>

          {/* Side-by-Side Content Area */}
          <div className="flex flex-col lg:flex-row gap-8 items-start mb-16">
            {/* Main Diagram Section (Left) */}
            <section className="w-full lg:w-[62%]">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 rounded-lg">
                    <Activity size={16} className="text-blue-500" />
                  </div>
                  <h3 className="text-lg font-black tracking-tight uppercase text-white/90">Execution Pipeline</h3>
                </div>
                <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
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
                  <h3 className="text-lg font-black text-white/90 uppercase tracking-tight mb-1">Protocol Milestones</h3>
                  <div className="h-0.5 w-12 bg-blue-500/30 rounded-full" />
                </div>

                <div className="glass rounded-2xl overflow-hidden border-white/5 shadow-2xl transition-all mb-3">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-white/5">
                        <th className="px-4 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-blue-400">Lucid Sequence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {ARCHITECTURE_COMPARISONS.map((row, i) => {
                        const isHighlighted = activeArchitectureStep !== null && row.relatedStepIds?.includes(activeArchitectureStep)
                        return (
                          <tr 
                            key={i} 
                            className={`transition-all duration-500 group cursor-default relative
                              ${isHighlighted ? 'bg-blue-600/15' : 'hover:bg-white/[0.02]'}
                            `}
                            onMouseEnter={() => {
                              if (row.relatedStepIds?.length) setActiveArchitectureStep(row.relatedStepIds[0])
                            }}
                            onMouseLeave={() => setActiveArchitectureStep(null)}
                          >
                            <td className="px-4 py-3 relative overflow-hidden">
                              {/* Highlight Indicator Bar */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-500 ${isHighlighted ? 'bg-blue-500 opacity-100 scale-y-100' : 'bg-blue-500/0 opacity-0 scale-y-0'}`} />
                              
                              <div className="flex items-center gap-2.5">
                                <Zap size={11} className={`transition-all duration-500 ${isHighlighted ? 'text-blue-400 scale-125 glow-blue' : 'text-blue-500/30 group-hover:text-blue-500/50'}`} />
                                <span className={`text-[13px] font-bold transition-all duration-300 ${isHighlighted ? 'text-white translate-x-1' : 'text-blue-100/70 group-hover:text-white'}`}>
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
                <p className="px-2 text-[10px] font-mono text-slate-500 leading-relaxed uppercase tracking-widest">
                  * Hover milestones to highlight steps
                </p>
              </div>

              {/* Role of Noir ZK Section */}
              <div className="glass rounded-2xl p-6 border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Gavel size={80} />
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                    <Gavel size={16} className="text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-black text-white/90 uppercase tracking-widest">The Role of Noir ZK</h3>
                </div>

                <div className="space-y-4 relative z-10">
                  <p className="text-sm font-medium text-slate-300 leading-relaxed">
                    In Lucid, Noir acts as a <span className="text-indigo-400 font-bold">Judge</span>, not a mediator.
                  </p>

                  <ul className="space-y-3">
                  {[
                    "Was there true silence?",
                    "Are conditions fully met?",
                    "Is execution still valid?"
                  ].map((q, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="mt-1">
                        <CheckCircle2 size={12} className="text-blue-500/50" />
                      </div>
                      <span className="text-xs text-slate-400 italic font-light">"{q}"</span>
                    </li>
                  ))}
                </ul>

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Noir answers these questions with a binary <span className="text-white font-bold">Yes / No</span>, 
                      providing absolute verification <span className="text-indigo-400/80 underline decoration-indigo-500/30 underline-offset-4">without revealing any raw data</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Core Philosophy Caption */}
              <div className="glass px-6 py-5 rounded-2xl border-blue-500/20 relative group overflow-hidden text-center">
                <div className="absolute inset-0 bg-blue-500/[0.03] group-hover:bg-blue-500/[0.07] transition-colors" />
                <Quote className="absolute -top-2 -left-2 text-blue-500/5" size={40} />
                <p className="text-base md:text-lg font-light italic text-blue-100 relative z-10 leading-relaxed">
                  "Lucid replaces <span className="text-blue-400 font-bold">payment</span> with <span className="text-blue-400 font-bold">silence</span>, 
                  and verifies it with <span className="text-white font-semibold">Noir ZK</span>."
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-6 z-20">
        <div className="max-w-5xl mx-auto text-center">
          <div className="material-card material-elevation-8 rounded-2xl p-12 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-blue-500/20 border border-blue-500/30 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"></div>
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
                Ready to Preserve Your Intent?
              </h2>
              <p className="text-xl md:text-2xl text-slate-200 mb-10 max-w-3xl mx-auto leading-relaxed">
                Create your first Memory Capsule and ensure your decisions live on, even when you can&apos;t.
              </p>
              <Link href="/create">
                <button className="material-button material-elevation-4 hover:material-elevation-8 px-10 py-5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-bold text-lg flex items-center gap-3 mx-auto transition-all shadow-xl shadow-blue-500/40 hover:shadow-blue-500/60 group">
                  Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-16 px-6 border-t border-slate-800/50 backdrop-blur-sm z-20">
        <div className="max-w-7xl mx-auto text-center text-slate-400">
          <p className="text-base">Built on Solana • Preserving Intent, Not Just Assets</p>
        </div>
      </footer>
    </div>
  )
}
