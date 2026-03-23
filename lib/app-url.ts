const DEFAULT_PRODUCTION_APP_ORIGIN = 'https://app.heresprotocol.com'

export function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_ORIGIN) {
    return process.env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/+$/, '')
  }

  return process.env.NODE_ENV === 'production' ? DEFAULT_PRODUCTION_APP_ORIGIN : ''
}

export function getAppHref(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const appOrigin = getAppOrigin()
  return appOrigin ? `${appOrigin}${normalizedPath}` : normalizedPath
}
