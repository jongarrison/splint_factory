# Organization Management System - Agent Instructions

## Overview
The Splint Factory application requires a multi-tenant organization system where users are grouped into organizations with different permission levels. This system supports admin-controlled organization management and user invitation workflows.

## Core Requirements

### User Types and Permissions
- **System Admins**: Full system access, can create/manage organizations, manage all users
- **Organization Admins**: Can manage their organization, invite users, manage organization settings
- **Organization Members**: Can create splint designs, view print queue for their organization
- **Unregistered Users**: Can register via invitation links only

### Organization Structure
- Each organization has a unique name and settings (printer configurations, material preferences, etc.)
- Users belong to exactly one organization (no multi-org membership initially)
- Organizations are isolated from each other - users can only see data from their own organization
- System admins can see/manage all organizations

## Database Schema Requirements

### Organizations Table
```
- id (primary key)
- name (unique, required)
- description (optional)
- created_at
- updated_at
- settings (JSON field for printer configs, materials, etc.)
- is_active (boolean, for soft deletion)
```

### Users Table Additions
```
- organization_id (foreign key to organizations)
- role (enum: 'system_admin', 'org_admin', 'member')
- is_active (boolean)
- invited_by_user_id (foreign key to users, nullable)
- invitation_accepted_at (timestamp, nullable)
```

### Invitation Links Table
```
- id (primary key)
- token (unique, random string)
- organization_id (foreign key)
- created_by_user_id (foreign key to users)
- email (optional, for targeted invites)
- expires_at (timestamp)
- used_at (timestamp, nullable)
- used_by_user_id (foreign key to users, nullable)
- max_uses (integer, default 1)
- current_uses (integer, default 0)
```

## User Interface Requirements

### System Admin Interfaces
**Organization Management Dashboard**
- List all organizations with member counts, creation dates, and status
- Create new organization form (name, description, initial settings)
- Edit organization details and settings
- Deactivate/reactivate organizations (soft delete)
- View organization members and their roles

**User Management Dashboard**
- List all users across all organizations
- Change user roles and organization assignments
- Deactivate/reactivate user accounts
- View user activity and invitation history

### Organization Admin Interfaces
**Organization Settings Page**
- Edit organization name and description
- Manage printer configurations for the organization
- Set default material and print settings
- View organization usage statistics

**Member Management Page**
- List all organization members with roles and join dates
- Promote members to organization admin role
- Generate invitation links (single-use or multi-use)
- View and manage active invitation links
- Remove members from organization

**Invitation Link Management**
- Create targeted invitations (with specific email)
- Create general invitation links for sharing
- Set expiration dates for invitations
- View invitation usage statistics
- Deactivate unused invitation links

### Member Interfaces
**Simple Invitation Sharing**
- Generate basic invitation links to share with colleagues
- View who they have invited and invitation status

## Authentication and Authorization

### Route Protection
- System admin routes: Only accessible to users with 'system_admin' role
- Organization admin routes: Accessible to 'system_admin' and users with 'org_admin' role in the same org
- Organization member routes: Accessible to all organization members
- Data isolation: All queries must filter by organization_id except for system admins

### Invitation Flow
1. Admin/member creates invitation link with optional email and expiration
2. Invitation link contains secure token that maps to organization
3. Unregistered user clicks link, sees registration form pre-filled with organization info
4. Upon successful registration, user is automatically added to the organization
5. Invitation is marked as used and invitation creator is notified

## Standard Functionality Expansions

### Audit Logging
- Track all organization changes (creation, settings updates, member changes)
- Log invitation creation and usage
- Record role changes and permission modifications
- Maintain user activity logs for compliance

### Reporting and Analytics
- Organization usage reports (print jobs, active users, etc.)
- Invitation effectiveness tracking
- User engagement metrics per organization
- System-wide statistics for system admins

## Implementation Priorities

### Phase 1: Core Organization Structure
1. Database schema updates for organizations and user roles
2. Basic organization creation and user assignment
3. Route protection and data isolation
4. Simple admin interfaces for organization management

### Phase 2: Invitation System
1. Invitation link generation and management
2. Registration flow with organization assignment
3. Email notification system
4. Invitation tracking and analytics

### Phase 3: Advanced Features
1. Audit logging and activity tracking
2. Advanced organization settings and customization
3. Reporting and analytics dashboards
4. User onboarding and help systems

## Security Considerations
- All invitation tokens must be cryptographically secure and time-limited
- Data isolation must be enforced at the database query level
- Role changes must be audited and require appropriate permissions
- Organization data must be completely isolated between organizations
- System admin access must be carefully controlled and logged

