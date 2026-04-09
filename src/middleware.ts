import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

// Define public routes that don't require authentication
// Include '/api' so API routes rely on route-level auth (API keys or session) instead of middleware redirects
const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/api', '/api/auth', '/api/register', '/l', '/client-auth', '/about', '/verify-email']

// Define routes that should redirect to home if already authenticated
const authRoutes = ['/login', '/register']

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Simple logging that should work in Edge Runtime
  const timestamp = new Date().toISOString()
  const logMessage = `${timestamp} - 🔥 MIDDLEWARE: ${request.method} ${pathname}`
  
  // Try multiple logging approaches
  console.log(logMessage)
  // console.warn(logMessage) // Sometimes warn() shows when log() doesn't
  // console.error(`� MIDDLEWARE TRACE: ${request.method} ${pathname}`) // Error usually shows
  
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

    // Get user organization info for data isolation (Phase 1)
    let organizationId = null
    let userRole = null
    if (session?.user?.id) {
      // Note: In a real app, we'd get this from the session token
      // For Phase 1, we'll add this to the response headers for later use
      organizationId = 'placeholder' // Will be populated properly in Phase 2
      userRole = 'MEMBER'
    }

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
    // (root '/' is public - shows about/landing content)
    if (!session && !isPublicRoute && pathname !== '/') {
      console.log(`🚫 REDIRECT: Unauthenticated user trying to access protected route ${pathname}`)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // If user is authenticated and trying to access auth routes, redirect to design-menu
    if (session && isAuthRoute) {
      console.log(`REDIRECT: Authenticated user trying to access auth route ${pathname}`)
      // Honor callbackUrl if present, otherwise go to design-menu (browser default)
      const callbackUrl = request.nextUrl.searchParams.get('callbackUrl')
      const destination = callbackUrl || '/design-menu'
      const redirectUrl = new URL(destination, request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // If user is authenticated but email not verified, redirect to /verify-email
    // (unless already on /verify-email or a public route)
    // Use === null to distinguish unverified users from old JWTs where field is undefined
    if (session && session.user.emailVerified === null && !isPublicRoute && pathname !== '/verify-email') {
      console.log(`REDIRECT: Unverified user trying to access ${pathname}`)
      const verifyUrl = new URL('/verify-email', request.url)
      return NextResponse.redirect(verifyUrl)
    }
    
    // If user is authenticated and trying to access home page, redirect to design-menu
    if (session && pathname === '/') {
      console.log(`🏠 REDIRECT: Authenticated user at homepage, redirecting to design-menu`)
      const geoJobMenuUrl = new URL('/design-menu', request.url)
      return NextResponse.redirect(geoJobMenuUrl)
    }

    // Add debug header and organization context (Phase 1)
    const response = NextResponse.next()
    response.headers.set('x-middleware-status', 'success')
    response.headers.set('x-middleware-auth', authState)
    
    // Phase 1: Add organization context to headers for future use
    if (organizationId) {
      response.headers.set('x-organization-id', organizationId)
      response.headers.set('x-user-role', userRole || 'MEMBER')
    }
    
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
    '/((?!_next/static|_next/image|images|favicon.ico|icon.svg|api/auth).*)',
  ],
}
