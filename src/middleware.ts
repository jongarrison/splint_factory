import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/api/auth']

// Define routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/register']

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Simple logging that should work in Edge Runtime
  const timestamp = new Date().toISOString()
  const logMessage = `${timestamp} - 🔥 MIDDLEWARE: ${request.method} ${pathname}`
  
  // Try multiple logging approaches
  console.log(logMessage)
  console.warn(logMessage) // Sometimes warn() shows when log() doesn't
  console.error(`� MIDDLEWARE TRACE: ${request.method} ${pathname}`) // Error usually shows
  
  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  // Check if the route is an auth route
  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  )

  try {
    // Get the session
    const session = await auth()

    // Log every request with auth state and user info
    const userInfo = session?.user ? 
      `User: ${session.user.name || session.user.email || 'Unknown'}` : 
      'No user'
    const authState = session ? 'Authenticated' : 'Not authenticated'
    const routeType = isPublicRoute ? 'Public' : 'Protected'
    
    // Log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`🌐 AUTH: ${authState} | ${userInfo} | ${routeType} route`)
    }

    // If user is not authenticated and trying to access a protected route
    if (!session && !isPublicRoute) {
      console.log(`🚫 REDIRECT: Unauthenticated user trying to access protected route ${pathname}`)
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // If user is authenticated and trying to access auth routes, redirect to home
    if (session && isAuthRoute) {
      console.log(`🏠 REDIRECT: Authenticated user trying to access auth route ${pathname}`)
      const homeUrl = new URL('/', request.url)
      return NextResponse.redirect(homeUrl)
    }

    // Add debug header and continue
    const response = NextResponse.next()
    response.headers.set('x-middleware-status', 'success')
    response.headers.set('x-middleware-auth', authState)
    
    return response
  } catch (error) {
    console.log(`❌ MIDDLEWARE ERROR: ${error}`)
    return NextResponse.next()
  }
}

// Configure which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except static files and NextAuth routes
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
