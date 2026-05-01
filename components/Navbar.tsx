'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeftCircle, LayoutGrid, Menu, ShieldCheck, X, ChevronDown } from 'lucide-react'
import '@solana/wallet-adapter-react-ui/styles.css'
import { getAppHref, getMarketingHref } from '@/lib/app-url'

const WalletMultiButton = dynamic(
  () =>
    import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
)

const homeHref = getMarketingHref('/')

const navLinks = [
  { href: `${homeHref}#how-it-works`, label: 'How it Works', activePaths: ['/'] },
  { href: 'https://github.com/Heres-Protocol/Heres-Protocol/blob/main/README.md', label: 'Docs' },
  { href: getAppHref('/dashboard'), label: 'Heres Public Explorer', activePaths: ['/dashboard'] },
  { href: 'https://github.com/Heres-Protocol/Heres-Protocol', label: 'View Security Audit' },
]

const NETWORKS = [
  { id: 'devnet', label: 'Solana Devnet' },
  { id: 'testnet', label: 'Solana Testnet' },
  { id: 'mainnet', label: 'Solana Mainnet' },
] as const

export function Navbar() {
  const pathname = usePathname()
  const [networkOpen, setNetworkOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<(typeof NETWORKS)[number]>(NETWORKS[0])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNetworkOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const showBackHome = pathname !== '/'

  return (
    <header className="nav-glass">
      <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="proto-nav-shell flex h-[68px] w-full items-center justify-between rounded-[22px] px-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <div className="flex flex-col">
              <Link href={homeHref} className="flex min-w-0 shrink-0 items-center gap-2">
                <Image src="/logo-white.png?v=3" alt="Heres" width={52} height={52} className="h-9 w-auto sm:h-11" priority unoptimized />
                <span className="truncate text-lg font-semibold tracking-[-0.04em] text-Heres-white sm:text-2xl">HERES</span>
              </Link>
              <span className="ml-[5.2rem] mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-green-500">• Live</span>
            </div>

            {showBackHome && (
              <Link href={homeHref} className="hidden items-center gap-2 border-l border-cyan-400/40 pl-5 text-sm text-slate-400 transition hover:text-white lg:flex">
                <ArrowLeftCircle className="h-4 w-4" />
                <span>Back To Homepage</span>
              </Link>
            )}
          </div>

          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => {
              const isActive = pathname === ('activePath' in link ? link.activePath : link.href) || ('activePaths' in link && link.activePaths?.includes(pathname))
              const isExplorer = link.label.includes('Explorer')
              const isAudit = link.label.includes('Audit')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${isActive ? 'text-cyan-300' : 'text-slate-400 hover:text-white'}`}
                >
                  <span>{link.label}</span>
                  {isExplorer && <LayoutGrid className="h-4 w-4 text-slate-500" />}
                  {isAudit && <ShieldCheck className="h-4 w-4 text-green-500" />}
                </Link>
              )
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-[#0c1633] text-white md:hidden"
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <div className="relative hidden sm:block" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setNetworkOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-[#0d1733] px-3.5 py-2 text-sm font-medium text-Heres-white transition-colors hover:border-cyan-300/50 hover:bg-[#111d3f]"
                aria-expanded={networkOpen}
                aria-haspopup="listbox"
                aria-label="Select network"
              >
                <span className="text-cyan-300">Solana</span>
                <ChevronDown className={`h-4 w-4 text-Heres-muted transition-transform ${networkOpen ? 'rotate-180' : ''}`} />
              </button>
              {networkOpen && (
                <ul
                  role="listbox"
                  className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-3xl border border-cyan-400/20 bg-[#0b1430] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
                >
                  {NETWORKS.map((net) => (
                    <li key={net.id} role="option" aria-selected={selectedNetwork.id === net.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNetwork(net)
                          setNetworkOpen(false)
                        }}
                        className={`flex w-full items-center rounded-2xl px-4 py-2.5 text-left text-sm transition-colors ${selectedNetwork.id === net.id
                          ? 'bg-cyan-400/15 text-cyan-300'
                          : 'text-Heres-white hover:bg-white/5'
                          }`}
                      >
                        {net.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="relative z-50 hidden items-center wallet-nav-trigger md:flex">
              <WalletMultiButton className="!h-12 !rounded-[16px] !border-0 !bg-[#2cb7d4] !px-6 !py-0 !text-sm !font-semibold !text-white transition-opacity hover:!opacity-90 active:scale-95" />
            </div>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="mx-3 mt-2 overflow-x-hidden rounded-[28px] border border-cyan-400/20 bg-[#0b1430]/95 backdrop-blur-xl md:hidden sm:mx-6 lg:mx-8"
          style={{
            minHeight: 'calc(100dvh - 6rem - env(safe-area-inset-top, 0px) - 25rem)',
          }}
        >
          <nav className="mx-auto max-w-7xl min-w-0 overflow-hidden px-4 py-4 sm:px-6">
            <ul className="flex flex-col gap-0.5">
              {showBackHome && (
                <li>
                  <Link href={homeHref} className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
                    <ArrowLeftCircle className="h-4 w-4" />
                    Back To Homepage
                  </Link>
                </li>
              )}
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className={`block rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${pathname === ('activePath' in link ? link.activePath : link.href)
                      || ('activePaths' in link && link.activePaths?.includes(pathname))
                      ? 'bg-cyan-400/20 text-white'
                      : 'text-white hover:bg-white/10'
                      }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-white/20 pt-2">
              <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-slate-300">Network</p>
              <div className="space-y-0.5">
                {NETWORKS.map((net) => (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => setSelectedNetwork(net)}
                    className={`flex w-full items-center rounded-2xl px-4 py-2.5 text-sm font-medium ${selectedNetwork.id === net.id ? 'bg-cyan-400/20 text-white' : 'text-white hover:bg-white/10'
                      }`}
                  >
                    {net.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mobile-menu-wallet-wrap mt-2 w-full min-w-0 overflow-hidden border-t border-white/20 px-6 pt-2 pb-3">
              <WalletMultiButton className="!h-11 !min-h-[44px] !w-full !max-w-full !min-w-0 !rounded-[16px] !border-0 !bg-[#2cb7d4] !px-4 !py-0 !text-sm !font-semibold !text-white transition-opacity hover:!opacity-90 active:scale-95" />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
