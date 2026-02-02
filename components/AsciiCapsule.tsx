'use client'

import { useRef, useEffect, useState } from 'react'

const ASCII_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%&*.:;\'"+=<>?/\\|[]{}'

const PHRASE = 'MAGICBLOCK ER'
const COLS = 52
const ROWS = 22

/** Indices in the grid where the phrase "MAGICBLOCK ER" is shown (center row, centered). */
const PHRASE_ROW = Math.floor(ROWS / 2)
const PHRASE_START_COL = Math.floor((COLS - PHRASE.length) / 2)
const PHRASE_INDICES = Array.from(
  { length: PHRASE.length },
  (_, k) => PHRASE_ROW * COLS + PHRASE_START_COL + k
)

const PHRASE_INDEX_SET = new Set(PHRASE_INDICES)

function getRandomChar() {
  return ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)]
}

/** Deterministic initial grid so server and client render the same HTML (avoids hydration error). */
function getInitialGrid(): string[] {
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    if (PHRASE_INDEX_SET.has(i)) {
      return PHRASE[PHRASE_INDICES.indexOf(i)]
    }
    return ASCII_CHARS[i % ASCII_CHARS.length]
  })
}

export function AsciiCapsule() {
  const [grid, setGrid] = useState<string[]>(getInitialGrid)
  const rafRef = useRef<number>(0)
  const lastTick = useRef(0)
  const revealRef = useRef(false)
  const interval = 80

  // Random char animation (skip phrase cells when revealing)
  useEffect(() => {
    const tick = (now: number) => {
      if (now - lastTick.current >= interval) {
        lastTick.current = now
        setGrid((prev) => {
          const next = [...prev]
          const toUpdate = Math.floor(COLS * ROWS * 0.12) || 1
          let updated = 0
          while (updated < toUpdate) {
            const idx = Math.floor(Math.random() * (COLS * ROWS))
            if (revealRef.current && PHRASE_INDEX_SET.has(idx)) continue
            next[idx] = getRandomChar()
            updated++
          }
          return next
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Periodically reveal "MAGICBLOCK ER" for ~1.8s, then back to chaos
  useEffect(() => {
    const reveal = () => {
      revealRef.current = true
      setGrid((prev) => {
        const next = [...prev]
        PHRASE_INDICES.forEach((idx, i) => {
          next[idx] = PHRASE[i]
        })
        return next
      })
      setTimeout(() => {
        revealRef.current = false
      }, 1800)
    }
    const t = setInterval(reveal, 4500)
    return () => clearInterval(t)
  }, [])

  // 웹사이트 색상: 시안(accent) #22d3ee, 보라(purple) #a78bfa
  const colorAccent = 'rgba(34, 211, 238, 0.95)'
  const colorAccentDim = 'rgba(34, 211, 238, 0.6)'
  const colorPurple = 'rgba(167, 139, 250, 0.9)'
  const colorPurpleDim = 'rgba(167, 139, 250, 0.5)'

  return (
    <div
      className="ascii-capsule-wrapper relative mx-auto flex items-center justify-center py-4"
      style={{ maxWidth: 480 }}
      aria-hidden
    >
      {/* 캡슐 = clip만 적용, 테두리 없음 → 테두리까지 전부 ASCII로 채워짐 */}
      <div
        className="ascii-capsule relative overflow-hidden bg-[var(--lucid-bg)] shadow-[0_0_32px_rgba(34,211,238,0.15)]"
        style={{
          width: '100%',
          aspectRatio: '2.2 / 1',
          maxHeight: 220,
          borderRadius: 9999,
          clipPath: 'inset(0 round 9999px)',
          transform: 'rotate(-8deg)',
        }}
      >
        <div
          className="absolute inset-0 grid place-content-center gap-0 p-1 font-mono leading-none"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            letterSpacing: '0.02em',
            fontSize: 'clamp(6px, 1.2vw, 9px)',
          }}
        >
          {grid.map((char, i) => {
            const col = i % COLS
            const row = Math.floor(i / COLS)
            const isPhrase = PHRASE_INDEX_SET.has(i)
            const opacity = isPhrase ? 1 : 0.5 + (i % 6) * 0.1
            const usePurple = (row + col) % 3 === 0
            const color = isPhrase ? colorAccent : usePurple ? colorPurpleDim : colorAccentDim
            return (
              <span
                key={i}
                className="ascii-char text-center transition-all duration-150"
                style={{
                  opacity,
                  color,
                  textShadow: isPhrase ? '0 0 6px rgba(34,211,238,0.5)' : 'none',
                }}
              >
                {char}
              </span>
            )
          })}
        </div>
        {/* 중앙 살짝 어두운 띠 “”) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            background: 'linear-gradient(90deg, transparent 38%, rgba(3,7,18,0.5) 50%, transparent 62%)',
          }}
        />
      </div>
    </div>
  )
}
