'use client'

import { useMemo } from 'react'
import { RSM_GEOGRAPHY_PATH_D } from '@/constants/rsmGeographyPath'

/* viewBox matches path coordinate range: x ~-16..737, y ~8..269 */
const VIEW_BOX = '-20 0 760 275'

/* Marker positions [x%, y%] on map – glowing purple dots */
const MARKERS: { x: number; y: number; size: 'sm' | 'md' | 'lg'; delay?: number }[] = [
  { x: 22, y: 38, size: 'lg', delay: 0 },
  { x: 14, y: 42, size: 'sm', delay: 0.3 },
  { x: 54, y: 26, size: 'md', delay: 0.1 },
  { x: 56, y: 32, size: 'sm', delay: 0.5 },
  { x: 52, y: 42, size: 'sm', delay: 0.2 },
  { x: 68, y: 34, size: 'lg', delay: 0.15 },
  { x: 82, y: 38, size: 'lg', delay: 0.25 },
  { x: 78, y: 42, size: 'sm', delay: 0.4 },
  { x: 62, y: 52, size: 'sm', delay: 0.35 },
  { x: 58, y: 58, size: 'sm', delay: 0.1 },
  { x: 76, y: 72, size: 'md', delay: 0.2 },
]

const sizeMap = { sm: 8, md: 14, lg: 22 }

export function WorldMapWhy() {
  const markers = useMemo(
    () =>
      MARKERS.map((m, i) => ({
        ...m,
        cx: -20 + (m.x / 100) * 760,
        cy: (m.y / 100) * 275,
        r: sizeMap[m.size],
        delay: m.delay ?? i * 0.1,
      })),
    []
  )

  return (
    <div className="why-build-map relative h-full min-h-[320px] w-full overflow-hidden rounded-2xl">
      <svg
        className="h-full w-full object-contain"
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id="why-map-land" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(139, 92, 246, 0.35)" />
            <stop offset="100%" stopColor="rgba(109, 40, 217, 0.25)" />
          </linearGradient>
          <filter id="why-marker-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="why-marker-gradient">
            <stop offset="0%" stopColor="rgba(167, 139, 250, 0.9)" />
            <stop offset="60%" stopColor="rgba(167, 139, 250, 0.4)" />
            <stop offset="100%" stopColor="rgba(167, 139, 250, 0)" />
          </radialGradient>
        </defs>
        {/* World map geography – single path (rsm-geography) */}
        <path
          className="rsm-geography"
          d={RSM_GEOGRAPHY_PATH_D}
          fill="url(#why-map-land)"
          stroke="rgba(167, 139, 250, 0.15)"
          strokeWidth="0.5"
        />
        {/* Glowing purple markers */}
        <g className="rsm-marker">
          {markers.map((m, i) => (
            <g key={i} filter="url(#why-marker-glow)">
              <circle
                cx={m.cx}
                cy={m.cy}
                r={m.r * 1.8}
                fill="url(#why-marker-gradient)"
                className="why-map-marker"
                style={{
                  animationDelay: `${m.delay}s`,
                }}
              />
              <circle
                cx={m.cx}
                cy={m.cy}
                r={m.r * 0.6}
                fill="rgba(167, 139, 250, 0.95)"
                className="why-map-marker-inner"
                style={{
                  animationDelay: `${m.delay}s`,
                }}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
