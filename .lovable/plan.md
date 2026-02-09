
# Implementation Plan: User Settings, Company Logo & Workspace Management

## Overview

This plan implements three major features following global best practices used by established platforms like Slack, Notion, and Microsoft Teams:

1. **User Profile Settings** - Personal account management (email, password, avatar, name)
2. **Company Logo Storage** - Persistent company branding with proper storage
3. **Workspace Management** - Add/edit/switch workspaces within a company

---

## Architecture Design

```text
┌─────────────────────────────────────────────────────────────────┐
│                     SETTINGS HIERARCHY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 Account (NEW)          → User-specific settings             │
│     ├── Profile (name, avatar)                                  │
│     ├── Email change                                            │
│     └── Password change                                         │
│                                                                 │
│  🏢 Company                → Company owner settings             │
│     ├── Company name                                            │
│     └── Company logo (stored in Storage)                        │
│                                                                 │
│  📁 Workspaces (NEW)       → Workspace management               │
│     ├── List all workspaces                                     │
│     ├── Create new workspace                                    │
│     └── Edit workspace settings                                 │
│                                                                 │
│  👥 Team & Roles           → (existing)                         │
│  🌍 Language & Region      → (existing)                         │
│  🔔 Notifications          → (existing)                         │
│  🎨 Appearance             → (existing)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: User Account Settings

### What will be implemented:
- **Profile Picture Upload** - Upload, preview, and save avatar to storage
- **Full Name Edit** - Update display name
- **Email Change** - With confirmation flow (Supabase handles verification)
- **Password Change** - Current password + new password + confirmation

### Database Changes:
- Create storage bucket `avatars` for user profile pictures
- Add RLS policies for avatar access (users can only manage their own)

### UI Components:
- New page: `src/pages/settings/AccountSettingsPage.tsx`
- Avatar upload with drag-and-drop or click-to-select
- Password change form with validation (min 8 characters)

### Best Practices Applied:
| Feature | Best Practice |
|---------|--------------|
| Avatar | Instant preview, 2MB limit, image validation |
| Password | Require current password, strength indicator, confirmation field |
| Email | Confirmation email sent, old email notified |
| Name | Real-time update, displayed across app immediately |

---

## Part 2: Company Logo Storage

### Storage Architecture:
```text
Storage Bucket: company-assets
├── {company_id}/
│   └── logo.{ext}    → Company logo (overwritten on change)
```

### Database Changes:
1. Add `logo_url` column to `companies` table
2. Create storage bucket `company-assets`
3. RLS policies: Only company owners can upload/modify logo

### Who Can Edit:
- Only users with `owner` role on the company can change the logo
- The logo is displayed to all company members

### Implementation:
- Update `CompanySettingsPage.tsx` to upload to storage
- Update `WorkspaceContext` to include `logo_url`
- Display logo in TopBar company switcher

---

## Part 3: Workspace Management

### Design Decision (Best Practice):
Following Slack/Notion pattern:
- Workspaces are shown in a dedicated settings section
- "Add Workspace" button in the workspace switcher dropdown
- Each workspace has its own settings page

### New Features:
1. **Workspace List** - See all workspaces in current company
2. **Create Workspace** - Modal or inline form
3. **Edit Workspace** - Name, default locale
4. **Delete Workspace** - With confirmation (owner only)

### UI Implementation:
- New page: `src/pages/settings/WorkspacesSettingsPage.tsx`
- Add "New Workspace" option in TopBar dropdown
- Workspace settings modal/page with name and locale

### Database Considerations:
- Already have RLS: owners/admins can create/update workspaces
- Need to add delete capability (with cascade handling)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/settings/AccountSettingsPage.tsx` | User profile, email, password settings |
| `src/pages/settings/WorkspacesSettingsPage.tsx` | Workspace list and management |
| `src/components/settings/AvatarUpload.tsx` | Reusable avatar upload component |
| `src/components/settings/PasswordChangeForm.tsx` | Secure password change form |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/SettingsPage.tsx` | Add Account and Workspaces sections |
| `src/pages/settings/CompanySettingsPage.tsx` | Connect logo upload to storage |
| `src/components/TopBar.tsx` | Show company logo, add "New Workspace" option |
| `src/contexts/AuthContext.tsx` | Add `updateEmail`, `updatePassword` methods |
| `src/contexts/WorkspaceContext.tsx` | Add `createWorkspace`, `updateWorkspace`, `deleteWorkspace` |
| `src/App.tsx` | Add new routes |
| Translation files | Add new translation keys |

---

## Database Migration

```sql
-- 1. Add logo_url to companies
ALTER TABLE public.companies 
ADD COLUMN logo_url TEXT;

-- 2. Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- 3. Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true);

-- 4. RLS for avatars bucket
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 5. RLS for company-assets bucket
CREATE POLICY "Company owners can upload logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' AND 
  public.has_company_role(
    auth.uid(), 
    (storage.foldername(name))[1]::uuid, 
    'owner'
  )
);

CREATE POLICY "Anyone can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');
```

---

## Technical Notes

### Security Considerations:
- Password change requires current password verification
- Email change requires email verification on both old and new addresses
- Company logo upload restricted to owners only
- File size limits: 2MB for avatars, 5MB for company logos
- File type validation: images only (JPEG, PNG, WebP, SVG)

### Supabase Auth Methods Used:
- `supabase.auth.updateUser({ email })` - Email change
- `supabase.auth.updateUser({ password })` - Password change
- Supabase Storage API for file uploads

### Best Practices Checklist:
- [x] Instant visual feedback on uploads
- [x] Loading states during async operations
- [x] Error handling with user-friendly messages
- [x] Form validation before submission
- [x] Confirmation dialogs for destructive actions
- [x] Proper RLS policies for data security
- [x] Image optimization (max dimensions, format)

---

## Updated Settings Menu Structure

```text
Settings
├── 👤 Account              ← NEW
│   └── Profile, email, password
├── 🏢 Company
│   └── Name, logo
├── 📁 Workspaces           ← NEW  
│   └── List, create, manage
├── 👥 Team & Roles
├── 🌍 Language & Region
├── 🔔 Notifications
└── 🎨 Appearance
```

This follows the hierarchy: Personal → Organization → Team → Preferences

