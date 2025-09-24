# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server (always use port 3000)
npm run dev          # Start with Turbopack on 0.0.0.0:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database operations
npx prisma studio                    # Open Prisma Studio GUI
npx prisma migrate dev --name <name> # Create new migration
npx prisma generate                  # Regenerate Prisma client
npx prisma migrate reset             # Reset database (destructive)
```

## Project Architecture

**Splint Factory** is a dual-context Next.js 15 application serving two distinct interfaces:

1. **Web Browser Access**: Users design custom splints by inputting geometry parameters, creating 3D print jobs
2. **Electron Desktop App**: Runs on Raspberry Pi networked with Bambu P1S printers, manages print queue and printer control

### Core System Design

**Adaptive Single Page Architecture**: The root route (`/`) detects client type (Electron vs Browser) and renders appropriate interface. Authentication pages (`/login`, `/register`) are separate.

**3D Printing Pipeline**: Geometry generation → Parameter input → Print queue → Printer control

### Database Architecture

The application uses a multi-tenant organizational structure with these key models:

- **Organization**: Top-level tenant with `users`, `invitationLinks`, `apiKeys`
- **User**: Role-based access (`SYSTEM_ADMIN`, `ORG_ADMIN`, `MEMBER`) with organization association
- **NamedGeometry**: Reusable 3D geometry templates with JSON parameter schemas
- **InvitationLink**: Token-based user onboarding with expiration
- **ApiKey**: Hashed API authentication with organization-scoped permissions

**Key Relationships**:
- Users belong to Organizations and can invite other users
- NamedGeometry templates are created by users and define parameter schemas
- API Keys enable external system integration with role-based access

### Critical Implementation Details

**File Structure Requirements**:
- **CRITICAL**: `middleware.ts` MUST be at `src/middleware.ts` (NOT project root) for Next.js 15 App Router
- API routes in `src/app/api/` following App Router conventions
- Components in `src/components/` with domain-based organization

**Authentication System**:
- NextAuth.js v5 (beta) with credentials provider
- bcryptjs password hashing
- Server-side session checking with `auth()` function
- Role-based authorization throughout API routes

**Development Server**:
- Always runs on port 3000 with hostname 0.0.0.0
- Uses Turbopack for fast development builds
- Kill conflicting processes: `lsof -ti:3000 | xargs kill -9`

## Technology Stack

- **Framework**: Next.js 15 with App Router and TypeScript
- **Authentication**: NextAuth.js v5 (beta) 
- **Database**: SQLite + Prisma ORM (production-ready for PostgreSQL/MySQL)
- **Styling**: Tailwind CSS v4
- **Development**: ESLint, Turbopack

## Domain Context

This application manages the creation and printing of custom medical splints. The dual-interface design separates patient/clinician geometry input (web) from technician print management (Electron app), enabling a streamlined workflow from design to physical production.