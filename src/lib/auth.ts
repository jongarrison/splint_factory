import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

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

        const email = credentials.email as string
        const password = credentials.password as string

        console.log('[Auth] Login attempt for:', email)

        const user = await prisma.user.findUnique({
          where: { email }
        })

        if (!user || !user.password) {
          console.log('[Auth] User not found or no password set:', email)
          return null
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
          console.log('[Auth] Invalid password for:', email)
          return null
        }

        console.log('[Auth] Login successful for:', email)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role, // Include role in the returned user object
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
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
      }
      return token
    }
  },
  pages: {
    signIn: '/login',
  }
})
