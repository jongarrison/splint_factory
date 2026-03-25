import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role?: string
      organizationId?: string
      organizationName?: string
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    role?: string
    organizationId?: string
    organizationName?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email: string
    name?: string | null
    role?: string
    organizationId?: string
    organizationName?: string
  }
}
