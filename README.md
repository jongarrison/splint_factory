# Splint Factory

Splint factory is a website that will run in two main contexts:
1. It will be accessed from normal browsers for the purpose of generating 3d geometry files that end up in a print queue
2. It wil be accessed by an electron app running on a raspberry pi which runs on the same network as a Bambu P1S printer. The electron app will monitor the print queue and allow a user to initiate a print. The electron app will display the status of the continuing print.


# Technical Background

A modern Next.js 15 full-stack web application with user authentication, built with TypeScript, Tailwind CSS, and Prisma ORM.

## 🚀 Features

- **Next.js 15** with App Router for modern React development
- **User Authentication** with NextAuth.js v5 (credentials-based)
- **TypeScript** for type safety and better developer experience
- **Tailwind CSS** for responsive, utility-first styling
- **Prisma ORM** with SQLite database for data persistence
- **Password Security** with bcryptjs hashing
- **Protected Routes** with automatic authentication checks
- **Responsive Design** that works on all devices

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 with App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Authentication | NextAuth.js v5 (beta) |
| Database | SQLite with Prisma ORM |
| Password Hashing | bcryptjs |
| Development | ESLint, Hot Reload |
| Deployment | Vercel-ready |

## 📁 Project Structure

```
splint_factory/
├── .github/
│   └── copilot-instructions.md    # GitHub Copilot configuration
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── migrations/                # Database migrations
│   └── dev.db                     # SQLite database file
├── src/
│   ├── app/                       # Next.js 15 App Router
│   │   ├── api/                   # API routes
│   │   │   ├── auth/[...nextauth]/ # NextAuth.js handler
│   │   │   └── register/          # User registration endpoint
│   │   ├── login/                 # Login page
│   │   ├── register/              # Registration page
│   │   ├── layout.tsx             # Root layout with SessionProvider
│   │   ├── page.tsx               # Protected home page
│   │   └── globals.css            # Global styles
│   ├── components/
│   │   └── auth/                  # Authentication components
│   │       ├── AuthProvider.tsx   # Session provider wrapper
│   │       └── SignOutButton.tsx  # Sign out component
│   └── lib/
│       ├── auth.ts                # NextAuth.js configuration
│       └── prisma.ts              # Prisma client setup
├── .env                           # Environment variables for Prisma
├── .env.local                     # Local environment variables
└── package.json                   # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.17 or later
- **npm**, yarn, pnpm, or bun
- Basic knowledge of React/Next.js

### Installation & Setup

1. **Navigate to the project directory**:
   ```bash
   cd splint_factory
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   
   The project includes `.env` and `.env.local` files with example configurations. For development, the default settings should work:
   
   ```bash
   # .env (Prisma configuration)
   DATABASE_URL="file:./dev.db"
   
   # .env.local (NextAuth configuration)
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Initialize the database**:
   ```bash
   # Run database migrations
   npx prisma migrate dev --name init
   
   # Generate Prisma client
   npx prisma generate
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### First Time Usage

1. Since the home page is protected, you'll be redirected to `/login`
2. Click "create a new account" to go to `/register`
3. Fill out the registration form with:
   - Full Name
   - Email Address
   - Password (and confirmation)
4. After successful registration, you'll be redirected to login
5. Log in with your credentials to access the protected home page

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npx prisma studio    # Open Prisma Studio (database GUI)
npx prisma migrate dev --name <name>  # Create new migration
npx prisma generate  # Regenerate Prisma client
npx prisma migrate reset  # Reset database
```

### VS Code Integration

The project includes VS Code tasks and GitHub Copilot instructions:

- **Tasks**: Run development server via VS Code Command Palette
- **Copilot Instructions**: Located in `.github/copilot-instructions.md` for better AI assistance

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Prisma database connection | `file:./dev.db` |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | Generate a secure string |
| `NEXTAUTH_URL` | Application URL | `http://localhost:3000` |

## 🔐 Authentication System

### How Authentication Works

1. **Registration**: 
   - Users create accounts via `/register`
   - Passwords are hashed with bcryptjs before storage
   - User data is stored in SQLite via Prisma

2. **Login**:
   - Users sign in via `/login` with email/password
   - NextAuth.js handles session management
   - JWT tokens are used for session persistence

3. **Protection**:
   - Pages use `auth()` server function to check authentication
   - Unauthenticated users are redirected to login
   - Client components use `useSession()` hook

### Database Schema

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // For credentials authentication
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Set Environment Variables** in Vercel dashboard:
   ```
   DATABASE_URL=your-production-database-url
   NEXTAUTH_SECRET=your-secure-random-string
   NEXTAUTH_URL=https://your-domain.vercel.app
   ```

4. **Database Migration** (if using external database):
   ```bash
   npx prisma migrate deploy
   ```

### Other Platforms

The app can be deployed to:
- **Netlify** (with serverless functions)
- **Railway** (with PostgreSQL)
- **AWS** (with RDS or DynamoDB)
- **Digital Ocean App Platform**

## 🎯 How This Project Was Created

### Step-by-Step Creation Process

1. **Project Initialization**:
   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
   ```

2. **Authentication Setup**:
   ```bash
   npm install next-auth@beta @auth/prisma-adapter prisma @prisma/client bcryptjs
   npm install --save-dev @types/bcryptjs
   ```

3. **Database Configuration**:
   ```bash
   npx prisma init
   # Updated schema.prisma with NextAuth models
   npx prisma migrate dev --name init
   ```

4. **File Structure Created**:
   - Authentication components (`AuthProvider`, `SignOutButton`)
   - API routes (`/api/auth/[...nextauth]`, `/api/register`)
   - Pages (`/login`, `/register`, protected home page)
   - Library files (`auth.ts`, `prisma.ts`)

5. **Configuration Files**:
   - NextAuth.js configuration with credentials provider
   - Prisma schema with User, Account, Session models
   - Environment variables for development
   - GitHub Copilot instructions

### Key Design Decisions

- **SQLite for Development**: Easy setup, file-based database
- **NextAuth.js v5**: Latest authentication solution for Next.js
- **Credentials Provider**: Email/password authentication (can be extended)
- **App Router**: Next.js 15's modern routing system
- **Server Components**: For better performance and SEO
- **TypeScript**: For type safety and better developer experience

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run build` and `npm run lint`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Troubleshooting

### Common Issues

**Build Errors**:
- Run `npm run build` to check for TypeScript errors
- Ensure all environment variables are set

**Database Issues**:
- Delete `prisma/dev.db` and run `npx prisma migrate dev`
- Check that `DATABASE_URL` is correctly set

**Authentication Issues**:
- Verify `NEXTAUTH_SECRET` is set
- Check that `NEXTAUTH_URL` matches your domain

**Development Server Issues**:
- Clear `.next` folder: `rm -rf .next`
- Restart development server: `npm run dev`

### Getting Help

- Check the [Next.js documentation](https://nextjs.org/docs)
- Review [NextAuth.js documentation](https://next-auth.js.org)
- Consult [Prisma documentation](https://www.prisma.io/docs)

---

**Built with ❤️ using Next.js 15, TypeScript, NextAuth.js, Prisma, and Tailwind CSS**
