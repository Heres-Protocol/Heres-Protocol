'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
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

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="nav-glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-lucid-white">
            Lucid
          </span>
          <span className="rounded bg-lucid-accent/20 px-1.5 py-0.5 text-xs font-medium text-lucid-accent">
            Solana
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

        <div className="flex items-center gap-4">
          <WalletMultiButton className="!rounded-xl !bg-lucid-surface !px-4 !py-2 !text-sm !font-medium !text-lucid-white hover:!bg-lucid-card [&>.wallet-adapter-button-trigger]:!rounded-xl" />
        </div>
      </div>
    </header>
  )
}
