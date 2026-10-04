import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { logAuditEvent } from "./audit"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true, // Trust all hosts - needed for production with custom domains
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Allow cookies over HTTP for local network
      }
    }
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[Auth] Missing credentials')
          return null
        }

        const email = (credentials.email as string).trim()
        const password = credentials.password as string

        console.log('[Auth] Login attempt for:', email)

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          include: { organization: { select: { name: true } } },
        })

        if (!user || !user.password) {
          console.log('[Auth] User not found or no password set:', email)
          return null
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
          console.log('[Auth] Invalid password for:', email)
          logAuditEvent({
            eventType: 'LOGIN_FAILED',
            channel: 'AUTH',
            targetUserId: user.id,
            organizationId: user.organizationId,
            metadata: { email: user.email, reason: 'invalid_password' },
          })
          return null
        }

        console.log('[Auth] Login successful for:', email)
        logAuditEvent({
          eventType: 'LOGIN_SUCCEEDED',
          channel: 'AUTH',
          actorId: user.id,
          targetUserId: user.id,
          organizationId: user.organizationId,
          metadata: { email: user.email },
        })
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId ?? undefined,
          organizationName: user.organization?.name,
          emailVerified: user.emailVerified,
        }
      }
    }),
    Credentials({
      id: "conference-registration",
      name: "conference-registration",
      credentials: {
        token: { label: "Token", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.token) return null

        const loginToken = await prisma.conferenceLoginToken.findUnique({
          where: { token: credentials.token as string },
          include: {
            user: { include: { organization: { select: { name: true } } } },
          },
        })

        if (!loginToken || loginToken.usedAt || loginToken.expiresAt <= new Date()) {
          if (loginToken) {
            logAuditEvent({
              eventType: 'CONFERENCE_INITIAL_LOGIN_FAILED',
              channel: 'AUTH',
              targetUserId: loginToken.user.id,
              organizationId: loginToken.user.organizationId,
              metadata: { reason: loginToken.usedAt ? 'token_used' : 'token_expired' },
            })
          }
          return null
        }

        const consumed = await prisma.conferenceLoginToken.updateMany({
          where: {
            id: loginToken.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        })

        if (consumed.count !== 1) {
          logAuditEvent({
            eventType: 'CONFERENCE_INITIAL_LOGIN_FAILED',
            channel: 'AUTH',
            targetUserId: loginToken.user.id,
            organizationId: loginToken.user.organizationId,
            metadata: { reason: 'token_already_consumed' },
          })
          return null
        }

        const user = loginToken.user
        logAuditEvent({
          eventType: 'CONFERENCE_INITIAL_LOGIN_SUCCEEDED',
          channel: 'AUTH',
          actorId: user.id,
          targetUserId: user.id,
          organizationId: user.organizationId,
          metadata: { email: user.email },
        })
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId ?? undefined,
          organizationName: user.organization?.name,
          emailVerified: user.emailVerified,
          emailVerificationGraceExpiresAt: user.emailVerificationGraceExpiresAt?.toISOString() ?? null,
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.email = token.email!
        session.user.name = token.name
        session.user.role = token.role as string
        session.user.organizationId = token.organizationId as string | undefined
        session.user.organizationName = token.organizationName as string | undefined
        session.user.emailVerified = token.emailVerified as string | null | undefined
        session.user.emailVerificationGraceExpiresAt = token.emailVerificationGraceExpiresAt as string | null | undefined
      }
      return session
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
        token.organizationId = user.organizationId
        token.organizationName = user.organizationName
        token.emailVerified = user.emailVerified instanceof Date
          ? user.emailVerified.toISOString()
          : user.emailVerified
        token.emailVerificationGraceExpiresAt = user.emailVerificationGraceExpiresAt
      }

      // Keep header/user-menu identity fields fresh without forcing logout.
      if (trigger === "update" && token.id) {
        try {
          const refreshedUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { organization: { select: { name: true } } },
          })

          if (refreshedUser) {
            token.email = refreshedUser.email
            token.name = refreshedUser.name
            token.role = refreshedUser.role
            token.organizationId = refreshedUser.organizationId
            token.organizationName = refreshedUser.organization?.name
            token.emailVerified = refreshedUser.emailVerified?.toISOString() ?? null
            token.emailVerificationGraceExpiresAt = refreshedUser.emailVerificationGraceExpiresAt?.toISOString() ?? null
          }
        } catch (error) {
          console.error("[Auth] Failed to refresh JWT user fields:", error)
        }
      }

      return token
    }
  },
  pages: {
    signIn: '/login',
  }
})
