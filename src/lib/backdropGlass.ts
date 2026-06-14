import type { CSSProperties } from 'react'

const BACKDROP_GLASS_ALPHA = 0.72

function parseAlphaToken(token: string): number | null {
  const s = token.trim()
  if (s.endsWith('%')) {
    const n = Number.parseFloat(s.slice(0, -1))
    return Number.isFinite(n) ? n / 100 : null
  }
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function softenHexColor(color: string): string | null {
  let hex = color.slice(1)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (hex.length === 4) return null
  if (hex.length === 8) {
    const a = Number.parseInt(hex.slice(6, 8), 16)
    if (a < 250) return null
    hex = hex.slice(0, 6)
  }
  if (hex.length !== 6) return null
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return null
  return `rgba(${r},${g},${b},${BACKDROP_GLASS_ALPHA})`
}

function softenOpaqueColorForBackdrop(color: string): string | null {
  const c = color.trim()
  if (!c) return null
  const lower = c.toLowerCase()
  if (lower.startsWith('rgba(')) {
    const inner = c.slice(5, -1)
    const parts = inner.split(',').map((p) => p.trim())
    if (parts.length !== 4) return null
    const a = parseAlphaToken(parts[3])
    if (a === null || a < 0.99) return null
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${BACKDROP_GLASS_ALPHA})`
  }
  if (lower.startsWith('rgb(')) {
    const inner = c.slice(4, -1)
    const parts = inner.split(',').map((p) => p.trim())
    if (parts.length !== 3) return null
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${BACKDROP_GLASS_ALPHA})`
  }
  if (c.startsWith('#')) return softenHexColor(c)
  return null
}

/** Makes backdrop-filter blur visible through rounded edges (frosted glass). */
export function applyBackdropGlassFix(container: CSSProperties): CSSProperties {
  const backdrop =
    typeof container.backdropFilter === 'string' ? container.backdropFilter : ''
  const webkitBackdrop =
    typeof container.WebkitBackdropFilter === 'string'
      ? container.WebkitBackdropFilter
      : ''
  if (!backdrop && !webkitBackdrop) return container

  const out: CSSProperties = {
    ...container,
    overflow: 'hidden',
  }

  const bg =
    typeof out.backgroundColor === 'string' ? out.backgroundColor : undefined
  if (bg) {
    const softened = softenOpaqueColorForBackdrop(bg)
    if (softened) out.backgroundColor = softened
  }

  return out
}
