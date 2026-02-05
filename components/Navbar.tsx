'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ChevronDown, Menu, X } from 'lucide-react'
import '@solana/wallet-adapter-react-ui/styles.css'

const WalletMultiButton = dynamic(
  () =>
    import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
)

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/create', label: 'Create' },
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

  return (
    <header className="nav-glass">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 pr-4 sm:px-6 sm:pr-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
          <Link href="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Image src="/logo-white.png?v=3" alt="Heres" width={52} height={52} className="h-9 w-auto sm:h-[52px]" priority unoptimized />
            <span className="truncate text-lg font-bold tracking-tight text-lucid-white sm:text-xl">Heres</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${pathname === link.href
                ? 'text-lucid-accent'
                : 'text-lucid-muted hover:text-lucid-white'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Mobile: hamburger top right (pr on container avoids clip) */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-lucid-border bg-lucid-surface text-white md:hidden ml-1"
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="relative hidden sm:block" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setNetworkOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-lucid-border bg-lucid-surface px-3 py-2 text-sm font-medium text-lucid-white transition-colors hover:border-lucid-accent/40 hover:bg-lucid-card"
              aria-expanded={networkOpen}
              aria-haspopup="listbox"
              aria-label="Select network"
            >
              <span className="text-lucid-accent">Solana</span>
              <ChevronDown className={`h-4 w-4 text-lucid-muted transition-transform ${networkOpen ? 'rotate-180' : ''}`} />
            </button>
            {networkOpen && (
              <ul
                role="listbox"
                className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-lucid-border bg-lucid-card py-1 shadow-lg"
              >
                {NETWORKS.map((net) => (
                  <li key={net.id} role="option" aria-selected={selectedNetwork.id === net.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNetwork(net)
                        setNetworkOpen(false)
                      }}
                      className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors ${selectedNetwork.id === net.id
                        ? 'bg-lucid-accent/20 text-lucid-accent'
                        : 'text-lucid-white hover:bg-lucid-surface'
                        }`}
                    >
                      {net.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Desktop: Connect visible in nav; mobile: Connect only inside hamburger */}
          <div className="relative z-50 hidden items-center wallet-nav-trigger md:flex">
            <WalletMultiButton className="!h-10 !rounded-xl !bg-lucid-surface !px-4 !py-0 !text-sm !font-medium !text-lucid-white transition-opacity hover:!bg-lucid-card active:scale-95" />
          </div>
        </div>
      </div>

      {/* Mobile menu: extend toward bottom, height slightly cut so panel doesn't go full viewport */}
      {mobileOpen && (
        <div
          className="border-t border-white/20 bg-[#0f172a] md:hidden overflow-x-hidden"
          style={{
            backgroundColor: '#0f172a',
            minHeight: 'calc(100dvh - 4rem - env(safe-area-inset-top, 0px) - 25rem)',
          }}
        >
          <nav className="mx-auto max-w-7xl px-4 py-2 sm:px-6 min-w-0 overflow-hidden">
            <ul className="flex flex-col gap-0.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block rounded-lg px-4 py-2 text-sm font-medium transition-colors ${pathname === link.href
                      ? 'bg-lucid-accent/30 text-white'
                      : 'text-white hover:bg-white/15'
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
                    className={`flex w-full items-center rounded-lg px-4 py-2 text-sm font-medium ${selectedNetwork.id === net.id ? 'bg-lucid-accent/30 text-white' : 'text-white hover:bg-white/15'
                      }`}
                  >
                    {net.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mobile-menu-wallet-wrap mt-2 w-full min-w-0 overflow-hidden border-t border-white/20 px-6 pt-2 pb-3">
              <WalletMultiButton className="!h-11 !min-h-[44px] !w-full !max-w-full !min-w-0 !rounded-xl !bg-lucid-surface !px-4 !py-0 !text-sm !font-medium !text-white transition-opacity hover:!bg-lucid-card active:scale-95" />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
