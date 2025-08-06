# GitHub Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a Next.js 15 full-stack web application with user authentication built using:

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js v5 (beta)
- **Database**: Prisma ORM
- **Password Hashing**: bcryptjs

## Key Conventions

### File Structure
- Use the `src/` directory structure
- API routes go in `src/app/api/`
- Page components go in `src/app/` following App Router conventions
- Shared components go in `src/components/`
- Utilities go in `src/lib/`
- Types go in `src/types/`

### Authentication
- Use NextAuth.js v5 patterns
- Implement proper session management
- Use server-side session checking for protected routes
- Hash passwords with bcryptjs before storing

### Code Style
- Use TypeScript strict mode
- Follow Next.js App Router conventions
- Use server and client components appropriately
- Implement proper error handling
- Use Tailwind CSS for styling

### Database
- Use Prisma for database operations
- Define clear schema models
- Use proper TypeScript types from Prisma
