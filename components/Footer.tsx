'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Zap } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/create', label: 'Create' },
]

const socialLinks = [
  { href: 'https://x.com/Heres_app', label: 'X (Twitter)', icon: 'x' },
]

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-lucid-border/50 bg-lucid-bg text-lucid-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Top section: brand + social | nav links */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Image src="/logo-white.png" alt="Heres" width={44} height={44} className="h-11 w-auto" />
              <span className="text-xl font-bold text-lucid-white">Heres</span>
              <Zap className="h-5 w-5 text-lucid-accent" aria-hidden />
            </div>
            <div className="flex gap-2">
              {socialLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-lucid-border bg-lucid-card/80 text-lucid-white transition-colors hover:border-lucid-accent/40 hover:text-lucid-accent"
                  aria-label={item.label}
                >
                  {item.icon === 'x' && <XIcon className="h-4 w-4" />}
                </a>
              ))}
            </div>
          </div>
          <nav className="flex flex-col items-end gap-2 sm:items-end">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-lucid-white/90 transition-colors hover:text-lucid-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-lucid-border/50" />

        {/* Bottom section: copyright | powered by (no Privacy / Terms) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-lucid-muted">
            © {new Date().getFullYear()} Heres. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-lucid-border bg-lucid-card/80 px-4 py-2 text-sm text-lucid-white transition-colors hover:border-lucid-accent/40"
            >
              <Zap className="h-4 w-4 text-lucid-accent shrink-0" />
              <span className="font-medium">Powered by Solana</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
