import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_HOSTS = new Set(['app.heresprotocol.com', 'www.app.heresprotocol.com'])

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase() || ''
  const url = request.nextUrl.clone()

  if (APP_HOSTS.has(host)) {
    if (url.pathname === '/' || url.pathname === '/home') {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-).*)'],
}
