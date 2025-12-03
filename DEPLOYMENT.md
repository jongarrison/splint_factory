# Vercel Deployment Guide

## Prerequisites
- [x] GitHub account (jongarrison)
- [ ] Vercel account (sign up at vercel.com with GitHub)
- [ ] Production database (PostgreSQL)
- [ ] Domain: splintfactory.com (NameCheap)

## Step 1: Vercel Account Setup
1. Go to https://vercel.com/signup
2. Click "Continue with GitHub"
3. Authorize Vercel to access your repositories

## Step 2: Import Project
1. In Vercel dashboard, click "Add New..." → "Project"
2. Find and select `splint_factory` repository
3. Vercel auto-detects Next.js configuration

## Step 3: Environment Variables
Add these in Vercel project settings → Environment Variables:

### Required Variables
```
DATABASE_URL=postgresql://user:password@host:port/database
NEXTAUTH_URL=https://splintfactory.com
NEXTAUTH_SECRET=<generate-with-openssl>
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### Optional Variables (for beta deployment)
```
BETA_IP_RESTRICTION=false
```

## Step 4: Database Setup
Your production database needs to be accessible from Vercel's servers.

Options:
- **Vercel Postgres** (easiest, integrated)
- **Supabase** (generous free tier)
- **Railway** (simple setup)
- **Neon** (serverless PostgreSQL)

### After choosing database:
1. Get the DATABASE_URL connection string
2. Add it to Vercel environment variables
3. Run Prisma migrations:
```bash
npx prisma migrate deploy
```

## Step 5: Deploy
1. Click "Deploy" in Vercel
2. Wait for build to complete (~2-3 minutes)
3. Vercel will give you a URL like: `splint-factory.vercel.app`

## Step 6: Custom Domain (splintfactory.com)
1. In Vercel project settings → Domains
2. Add `splintfactory.com` and `www.splintfactory.com`
3. Vercel will provide DNS records

### In NameCheap:
1. Go to Domain List → Manage → Advanced DNS
2. Add these records (Vercel will show exact values):
   - **A Record**: `@` → Vercel IP
   - **CNAME**: `www` → `cname.vercel-dns.com`
3. DNS propagation takes 5-60 minutes

## Step 7: Verify Deployment
1. Visit https://splintfactory.com
2. Test login functionality
3. Verify database connection
4. Check that authenticated routes work

## Future: Staging Environment
When ready for staging:
1. Create `staging` branch in git
2. Import same project again in Vercel (as separate project)
3. Configure to auto-deploy from `staging` branch
4. Use subdomain: `staging.splintfactory.com`

## Troubleshooting

### Build fails
- Check Vercel build logs
- Verify all dependencies in package.json
- Ensure TypeScript types are correct

### Database connection fails
- Verify DATABASE_URL is correct
- Ensure database allows connections from Vercel IPs
- Check that Prisma schema is up to date

### Authentication fails
- Verify NEXTAUTH_URL matches your domain
- Check NEXTAUTH_SECRET is set
- Ensure cookies work (not blocked by browser)

## Deployment Workflow (After Initial Setup)
1. Commit changes to `main` branch
2. Push to GitHub
3. Vercel automatically deploys
4. Takes ~2-3 minutes
5. Live at splintfactory.com

## Monitoring
- Vercel provides analytics and logs
- Set up alerts for deployment failures
- Monitor performance metrics in Vercel dashboard
