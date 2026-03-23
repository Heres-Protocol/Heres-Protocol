'use client'

import Link from 'next/link'
import Image from 'next/image'
import { LifeBuoy, Mail } from 'lucide-react'
import { getAppHref } from '@/lib/app-url'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: getAppHref('/dashboard'), label: 'Dashboard' },
  { href: getAppHref('/create'), label: 'Create' },
]

const socialLinks = [
  { href: 'https://x.com/Heres_app', label: 'X (Twitter)', icon: 'x' },
]

const contactLinks = [
  {
    href: 'mailto:hello@heresprotocol.com',
    label: 'General',
    value: 'hello@heresprotocol.com',
    icon: Mail,
  },
  {
    href: 'mailto:support@heresprotocol.com',
    label: 'Support',
    value: 'support@heresprotocol.com',
    icon: LifeBuoy,
  },
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
    <footer className="border-t border-Heres-border/50 bg-Heres-bg text-Heres-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Top section: brand + social | nav links */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Image src="/logo-white.png?v=3" alt="Heres" width={44} height={44} className="h-11 w-auto" unoptimized />
              <span className="text-xl font-bold text-Heres-white">Heres</span>
            </div>
            <div className="flex gap-2">
              {socialLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-Heres-border bg-Heres-card/80 text-Heres-white transition-colors hover:border-Heres-accent/40 hover:text-Heres-accent"
                  aria-label={item.label}
                >
                  {item.icon === 'x' && <XIcon className="h-4 w-4" />}
                </a>
              ))}
            </div>
            <div className="mt-2 max-w-md rounded-2xl border border-Heres-border/70 bg-gradient-to-br from-Heres-card/95 via-Heres-card/85 to-Heres-surface/70 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-Heres-accent/80">Contact</p>
                  <p className="mt-2 text-sm leading-relaxed text-Heres-muted">
                    Reach us for product questions, partnerships, or user support.
                  </p>
                </div>
                <div className="rounded-xl border border-Heres-accent/20 bg-Heres-accent/10 p-2 text-Heres-accent">
                  <Mail className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {contactLinks.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-Heres-border/70 bg-black/10 px-3 py-3 transition-all hover:border-Heres-accent/30 hover:bg-Heres-accent/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-lg border border-Heres-border/70 bg-Heres-surface/80 p-2 text-Heres-accent transition-colors group-hover:border-Heres-accent/30 group-hover:bg-Heres-accent/10">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-Heres-muted">
                          {item.label}
                        </p>
                        <p className="truncate text-sm text-Heres-white transition-colors group-hover:text-Heres-accent">
                          {item.value}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-Heres-muted transition-colors group-hover:text-Heres-accent">
                      Email
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <nav className="flex flex-col items-end gap-2 sm:items-end">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="py-1 text-sm text-Heres-white/90 transition-colors hover:text-Heres-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-Heres-border/50" />

        {/* Bottom section: copyright | powered by (no Privacy / Terms) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-Heres-muted">
            © {new Date().getFullYear()} Heres. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-Heres-border bg-Heres-card/80 px-4 py-2 text-sm text-Heres-white transition-colors hover:border-Heres-accent/40"
            >
              <Image src="/logos/solana.svg" alt="Solana" width={20} height={20} className="h-5 w-auto shrink-0" />
              <span className="font-medium">Powered by Solana</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
