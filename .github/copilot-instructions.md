# GitHub Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Goals
- Create a web application (front end and api) for medical splint geometry generation and 3d printing control
- Users will be able to input splint geometry parameters (mostly hand geomtry)
- Web server will store the splint input parameters for retrieval by the 3D geometry generation service
- Web server will receive 3D files from the geomtry generation service and store them for the 3D printing slicing service
- Web server will store sliced 3D files for printing
- Users will access the website in two ways:
    - Web browser (responsive design)
    - Electron desktop application (focused on 3D print queue viewing and 3D printer control)


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
