'use client'

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

const partners = [
  { name: 'Solana', href: 'https://solana.com', color: '#9945FF' },
  { name: 'Magicblock', href: 'https://www.magicblock.xyz', color: '#22d3ee' },
  { name: 'Helius', href: 'https://helius.dev', color: '#f97316' },
  { name: 'Phantom', href: 'https://phantom.app', color: '#ab9ff2' },
]

function PartnerBadge({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 py-4 backdrop-blur-sm"
      style={{ borderColor: `${color}40` }}
    >
      <span className="text-lg font-semibold" style={{ color }}>
        {name}
      </span>
    </div>
  )
}

export function PartnerLogos() {
  const trackRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!trackRef.current || !wrapRef.current) return
    const track = trackRef.current
    const wrap = wrapRef.current
    const width = track.scrollWidth / 2
    const tl = gsap.timeline({ repeat: -1 })
    tl.to(track, { x: -width, duration: 25, ease: 'none' })
    return () => tl.kill()
  }, [])

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden py-6">
      <div ref={trackRef} className="flex w-max gap-8">
        {[...partners, ...partners].map((p, i) => (
          <a
            key={`${p.name}-${i}`}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity hover:opacity-90"
          >
            <PartnerBadge name={p.name} color={p.color} />
          </a>
        ))}
      </div>
    </div>
  )
}
