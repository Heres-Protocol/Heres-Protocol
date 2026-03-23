const DEBUG_ENABLED = process.env.NODE_ENV !== 'production' || process.env.HERES_DEBUG_LOGS === '1'

export function debugLog(...args: unknown[]) {
  if (DEBUG_ENABLED) {
    console.log(...args)
  }
}

export function debugWarn(...args: unknown[]) {
  if (DEBUG_ENABLED) {
    console.warn(...args)
  }
}
