'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ChevronDown } from 'lucide-react'
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

  return (
    <header className="nav-glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-white.png" alt="Heres" width={52} height={52} className="h-[52px] w-auto" priority />
          <span className="text-xl font-bold tracking-tight text-lucid-white">
            Heres
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'text-lucid-accent'
                  : 'text-lucid-muted hover:text-lucid-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="relative" ref={dropdownRef}>
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
                        // TODO: switch RPC/network (e.g. update env or context)
                      }}
                      className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors ${
                        selectedNetwork.id === net.id
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
          <WalletMultiButton className="!rounded-xl !bg-lucid-surface !px-4 !py-2 !text-sm !font-medium !text-lucid-white hover:!bg-lucid-card [&>.wallet-adapter-button-trigger]:!rounded-xl" />
        </div>
      </div>
    </header>
  )
}
