import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role?: string
      organizationId?: string | null
      organizationName?: string
      emailVerified?: string | Date | null
      emailVerificationGraceExpiresAt?: string | null
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    role?: string
    organizationId?: string | null
    organizationName?: string
    emailVerified?: string | Date | null
    emailVerificationGraceExpiresAt?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email: string
    name?: string | null
    role?: string
    organizationId?: string | null
    organizationName?: string
    emailVerified?: string | Date | null
    emailVerificationGraceExpiresAt?: string | null
  }
}
