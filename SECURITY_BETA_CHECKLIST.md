# Beta Security Checklist

## ✅ Already Implemented (Good!)

### Authentication
- [x] NextAuth session authentication on protected routes
- [x] API key authentication for external services (geo processor)
- [x] Permission-based access control (`checkApiPermission`)
- [x] Organization-based data isolation
- [x] Password hashing with bcryptjs

### API Security
- [x] All sensitive API routes require authentication
- [x] Organization checks prevent cross-org data access
- [x] Binary file exclusion in list endpoints (performance + security)

## 🔒 Quick Wins (Add Now)

### 1. IP Allowlist for Beta (DONE)
- [x] Created `middleware.ts` with IP restriction
- [ ] Set `BETA_IP_RESTRICTION=true` in Vercel
- [ ] Add your IPs to `ALLOWED_IPS` array

### 2. Environment Variables
- [ ] Create `.env.example` (template for required vars)
- [ ] Ensure `.env.local` is in `.gitignore`
- [ ] Set `NEXTAUTH_SECRET` in Vercel (generate with `openssl rand -base64 32`)
- [ ] Set `NEXTAUTH_URL` to production domain

### 3. Rate Limiting (Simple)
```typescript
// Add to middleware.ts if needed - Vercel has built-in DDoS protection
```

## 🛡️ Medium Priority (Before Public Launch)

### Input Validation
- [ ] Add Zod schemas for API request validation
- [ ] Validate file uploads (size limits, file types)
- [ ] Sanitize user input in CustomerNote, CustomerID fields

### Database Security
- [ ] Review Prisma queries for SQL injection risks (Prisma is safe by default)
- [ ] Add indexes for performance on filtered queries
- [ ] Consider row-level security when moving to PostgreSQL

### API Key Security
- [ ] Implement API key rotation
- [ ] Add API key expiration dates
- [ ] Log API key usage for audit trail

### File Upload Security
- [ ] Validate 3MF file structure before processing
- [ ] Scan uploads for malware (ClamAV or similar)
- [ ] Limit file sizes (add to API routes)

## 📊 Monitoring & Logging

### Immediate
- [ ] Enable Vercel Analytics (free)
- [ ] Monitor error logs in Vercel dashboard
- [ ] Set up email alerts for 500 errors

### Later
- [ ] Add Sentry for error tracking
- [ ] Log failed authentication attempts
- [ ] Monitor API key usage patterns

## 🚨 Known Risks (Accept for Beta)

### Low Risk (Document & Accept)
1. **No CAPTCHA on registration** - Acceptable if IP-restricted
2. **No 2FA** - Add before production
3. **Limited audit logging** - Add when needed
4. **No file virus scanning** - Only trusted users in beta

### Medium Risk (Monitor)
1. **SQLite in production** - Fine for beta, migrate to PostgreSQL later
2. **No backup strategy** - Add automated backups before production
3. **Session management** - NextAuth handles this well, but review session timeout

## 🔐 Pragmatic Security Strategy for Beta

### Phase 1: Beta (Now) - IP Restricted
✅ Focus: Keep bad actors out with IP allowlist
- Enable IP restriction middleware
- Only allow known IPs (office, home, Pi devices)
- Document IPs in team doc (not in code)

### Phase 2: Private Beta (Week 2-4) - Invited Users Only
✅ Focus: Controlled user base
- Remove IP restriction
- Require invitation codes
- Monitor usage patterns
- Add basic rate limiting if needed

### Phase 3: Public Beta (Month 2+) - Open Registration
✅ Focus: Handle scale & abuse
- Add CAPTCHA
- Implement rate limiting
- Add file virus scanning
- Enable comprehensive logging
- Consider CDN/WAF (Cloudflare free tier)

## 🎯 What You DON'T Need to Worry About (Yet)

- ❌ Penetration testing
- ❌ SOC2 compliance
- ❌ Advanced threat detection
- ❌ Zero-trust architecture
- ❌ Multi-region failover
- ❌ Complex RBAC beyond org boundaries

## 📋 Pre-Deployment Checklist

Before pushing to Vercel:

```bash
# 1. Check for secrets in code
git grep -i "password\|secret\|api.key" -- ':!SECURITY_BETA_CHECKLIST.md'

# 2. Verify .gitignore
cat .gitignore | grep -E "\.env|\.db|node_modules"

# 3. Test authentication locally
npm run dev
# Try accessing API routes without auth - should get 401

# 4. Review API routes
find src/app/api -name "route.ts" -exec grep -L "auth()" {} \;
# Should only return /api/register/route.ts (public by design)
```

## 🔧 Quick Security Audit Script

```typescript
// scripts/audit-api-routes.ts
// Run: npx tsx scripts/audit-api-routes.ts

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const apiDir = 'src/app/api';
const publicRoutes = ['register', 'auth']; // Known public routes

function findRouteFiles(dir: string): string[] {
  // Recursively find all route.ts files
  // Check if they have auth() or validateApiKey()
  // Report any missing auth
}

// Run audit
```

## 🎓 Security Best Practices You're Already Following

1. ✅ **Defense in Depth**: Multiple layers (IP, auth, org checks)
2. ✅ **Principle of Least Privilege**: API keys have specific permissions
3. ✅ **Secure by Default**: All routes require auth unless explicitly public
4. ✅ **Data Isolation**: Organization-based filtering prevents data leaks
5. ✅ **No Secrets in Code**: Using environment variables

## 📞 Emergency Response Plan

If you detect suspicious activity:

1. **Immediate**: Enable IP restriction in Vercel dashboard
2. **Within 1 hour**: Rotate all API keys
3. **Within 24 hours**: Review logs, invalidate sessions if needed
4. **Within 1 week**: Implement additional security measures

## 🎯 Bottom Line for Beta

**You're in good shape!** Your current security posture is:

- ✅ Strong authentication/authorization
- ✅ Organization-based data isolation  
- ✅ No obvious SQL injection vectors (Prisma)
- ✅ Secrets in environment variables

**Just add:**
1. IP allowlist (already created in middleware.ts)
2. Set proper environment variables in Vercel
3. Monitor logs for first few days

**That's it for beta.** The IP allowlist alone gives you time to harden other areas.
