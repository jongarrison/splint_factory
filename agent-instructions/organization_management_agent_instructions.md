# Organization Management System - Agent Instructions

## Overview
The Splint Factory application requires a multi-tenant organization system where users are grouped into organizations with different permission levels. This system supports admin-controlled organization management and user invitation workflows.

## Core Requirements

- Consider implementation of the following requirements with an eye towards practical, simple interfaces and apis. We are in a prototype phase and we have to be careful to avoid cumbersome solutions. At this prototype phase don't worry about data migration, but give default values if necessary.
- If at any point there are questions to resolve, pause implementation and ask for clarification
- User server log messages for any user actions. 
- Compose a companion document next to this one for capturing implementation overview and mention issues for future consideration

### User Types and Permissions
- **System Admins**: Full system access, can create/manage organizations, manage all users
- **Organization Admins**: Can manage their organization, invite users, manage organization settings
- **Organization Members**: Can create splint designs, view print queue for their organization
- **Unregistered Users**: Can register via invitation links only, registration page will accept an invitation code

### Organization Structure
- Each organization has a unique name and settings
- Users belong to exactly one organization (no multi-org membership), a default system organization will be used for system_admin users.
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
- email (for targeted invites)
- expires_at (timestamp)
- used_at (timestamp, nullable)
- used_by_user_id (foreign key to users, nullable)
```

## User Interface Requirements

### System Admin Interfaces
**Organization Management Dashboard**
- system_admin only
- List all organizations with member counts, creation dates, and status
- Create new organization form (name, description, initial settings)
- Edit organization details and settings
- Deactivate/reactivate organizations (soft delete)
- View organization members and their roles

**User Management Dashboard**
- system_admin only
- List all users across all organizations
- Change user roles and organization assignments
- Deactivate/reactivate user accounts
- User promotion, organization_admin users can promote members to organization_admins or members, system_admin users can promote any user to any type.

**Invitation Link Management**
- system_admin only
- View invitation usage statistics
- Deactivate unused invitation links

### Member Interfaces
**Simple Invitation Sharing**
- Any user can generate basic invitation links to share with colleagues in the same organization
- View who they have invited and invitation status

## Authentication and Authorization

### Route Protection
- System admin routes: Only accessible to users with 'system_admin' role
- Organization admin routes: Accessible to 'system_admin' and users with 'org_admin' role in the same org
- Organization member routes: Accessible to all organization members
- Data isolation: All queries must filter by organization_id except for system admins

RECOMMENDED: Middleware-based with simple rule:
- If user.organization_id === "system_admin_org_id": no filtering
- Else: filter all queries by user.organization_id

### Invitation Flow
1. Admin/member creates invitation link with optional email and expiration
2. Invitation link contains secure token that maps to organization
3. Unregistered user clicks link, sees registration form pre-filled with organization info, and invitation code
4. Upon successful registration, user is automatically added to the organization a member, later org_admin or system_admin users can promote the new member
5. Invitation is marked as used and invitation creator is notified

## Standard Functionality Expansions

### Audit Logging (in a simple, general purpose db log table)
- Track all organization changes (creation, settings updates, member changes)
- Log invitation creation and usage
- Record role changes and permission modifications
- Maintain user activity logs for compliance
- Create standard code for logging important events. It is not critical that all important events are identified now, but generally any action that changes the database should be logged.

## Implementation Priorities

### Phase 1: Core Organization Structure
1. Database schema updates for organizations and user roles
2. Basic organization creation and user assignment
3. Route protection and data isolation
4. Simple admin interfaces for organization management

### Phase 2: Invitation System
1. Invitation link generation and management
2. Registration flow with organization assignment
3. Invitation tracking and analytics
4. User management (viewing, user promotion). Options shown are appropriate to the type of user viewing
5. Consolidate admin/organization/user management links into a drop down menu to keep it visually manageable. These links only appear in the web (non-electron) version of the app.

### Phase 3: Advanced Features
1. Audit logging and activity tracking
2. Advanced organization settings and customization
3. Reporting and analytics dashboards
4. User onboarding and help systems

## Security Considerations
- All invitation tokens must be have a random token with url friendly length and be time-limited
- Data isolation should be enforced at the database query level when appropriate




