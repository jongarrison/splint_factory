# GitHub Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Goals
Create a **single page application** that adapts its functionality based on the client type:

### **Two Usage Scenarios:**
1. **Electron Desktop App** (Bambu 3D Printer Control)
   - Runs on the same network as a Bambu 3D printer
   - Primary focus: 3D print queue management and printer control
   - Shows print jobs submitted from web browsers
   - Controls printer operations (start, pause, monitor progress)

2. **Web Browser Access** (Splint Design & Job Creation)
   - Users input splint geometry parameters (hand geometry)
   - Generate 3D print jobs that appear in the Electron app's print queue
   - Web-based design interface for creating splint specifications

### **System Architecture:**
- **Minimal Pages**: Main app on `/` root route, dedicated auth pages (`/login`, `/register`)
- **Adaptive Interface**: Root page adapts UI/functionality based on client detection (Electron vs Browser)
- **Backend Services**: Store splint parameters, 3D files, and print queue data
- **3D Pipeline**: Geometry generation → Slicing → Print queue → Printer control


## Project Technology Overview
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
- **CRITICAL**: `middleware.ts` MUST be located at `src/middleware.ts` (NOT at project root) for Next.js 15 App Router

### Authentication
- Use NextAuth.js v5 patterns
- Implement proper session management
- Use server-side session checking for protected routes
- Hash passwords with bcryptjs before storing

### Middleware
- **CRITICAL**: Middleware file location is `src/middleware.ts` for Next.js 15 App Router
- Middleware at project root (`/middleware.ts`) will NOT work with this configuration
- Use Edge Runtime compatible code (avoid Node.js specific APIs)
- Include comprehensive logging for debugging authentication flows

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

### Development Server
- **ALWAYS run the development server on port 3000**
- Use `npm run dev` which is configured to start on port 3000
- If port 3000 is in use, kill the process using it first: `lsof -ti:3000 | xargs kill -9`
