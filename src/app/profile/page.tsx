'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import { validatePassword, PASSWORD_REQUIREMENTS_TEXT } from '@/lib/password';

export default function ProfilePage() {
  const { profile, loading, error, updating, updateProfile } = useProfile();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email,
      });
    }
  }, [profile]);

  const emailChanged = profile ? formData.email !== profile.email : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');

    // Confirm email change with user
    if (emailChanged) {
      const confirmed = window.confirm(
        'Changing your email address will require re-verification. ' +
        'You will be signed out and need to verify your new email before signing back in. Continue?'
      );
      if (!confirmed) return;
    }
    
    // Validate password fields if changing password
    if (showPasswordSection) {
      if (!passwordData.currentPassword || !passwordData.newPassword) {
        return; // Form validation will handle this
      }
      
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        return;
      }
      
      const passwordCheck = validatePassword(passwordData.newPassword);
      if (!passwordCheck.valid) {
        return;
      }
    }

    const updateData = {
      ...formData,
      ...(showPasswordSection && passwordData.currentPassword && passwordData.newPassword ? {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      } : {}),
    };
    
    const result = await updateProfile(updateData);
    
    if (result.success) {
      // Email change: sign out so user can re-verify and get fresh JWT
      if (emailChanged) {
        signOut({ callbackUrl: '/login' });
        return;
      }

      setSuccessMessage(
        showPasswordSection 
          ? 'Profile and password updated successfully!' 
          : 'Profile updated successfully!'
      );
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Clear password fields on success
      if (showPasswordSection) {
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setShowPasswordSection(false);
      }
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email,
      });
    }
    // Reset password fields
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowPasswordSection(false);
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center" data-testid="profile-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
          <p className="mt-2 text-muted">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="page-shell flex items-center justify-center" data-testid="profile-error">
        <div className="card p-6 max-w-md w-full">
          <div className="text-[var(--status-error-text)] text-center">
            <p className="font-semibold">Error loading profile</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <Link
            href="/"
            className="btn-primary mt-4 block text-center py-2 px-4"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-8" data-testid="profile-page">
      <div className="max-w-2xl mx-auto px-4">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">My Profile</h1>
            <Link
              href="/"
              className="text-link"
            >
              ← Back to Home
            </Link>
          </div>

          {successMessage && (
            <div className="alert-success mb-4" data-testid="success-alert">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="alert-error mb-4" data-testid="error-alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-secondary mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                data-testid="name-input"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                data-testid="email-input"
                required
              />
              <p className="mt-1 text-sm text-muted">Changing your email will require re-verification.</p>
            </div>

            {/* Organization Information */}
            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-secondary mb-1">
                Organization
              </label>
              <input
                type="text"
                id="organization"
                value={profile?.organization?.name || 'No organization assigned'}
                readOnly
                className="input-field cursor-not-allowed opacity-60"
              />
              {profile?.organization?.description && (
                <p className="mt-1 text-sm text-muted">{profile.organization.description}</p>
              )}
            </div>

            {/* Role Information */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-secondary mb-1">
                Role
              </label>
              <input
                type="text"
                id="role"
                value={profile?.role ? profile.role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : 'Member'}
                readOnly
                className="input-field cursor-not-allowed opacity-60"
              />
            </div>

            {/* Password Section */}
            <div className="border-t border-[var(--border)] pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-primary">Password</h3>
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="text-sm text-link"
                >
                  {showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
                </button>
              </div>

              {showPasswordSection && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-secondary mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="input-field"
                      required={showPasswordSection}
                    />
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-secondary mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="input-field"
                      minLength={8}
                      required={showPasswordSection}
                    />
                    <p className="text-sm text-muted mt-1">{PASSWORD_REQUIREMENTS_TEXT}</p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className={`input-field ${
                        passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword
                          ? 'border-[var(--status-error-text)]'
                          : ''
                      }`}
                      required={showPasswordSection}
                    />
                    {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="text-sm text-[var(--status-error-text)] mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {profile && (
              <div className="text-sm text-muted">
                <p>Member since: {new Date(profile.createdAt).toLocaleDateString()}</p>
                {profile.updatedAt && (
                  <p>Last updated: {new Date(profile.updatedAt).toLocaleDateString()}</p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={updating || (showPasswordSection && passwordData.newPassword !== passwordData.confirmPassword)}
                className="btn-primary py-2 px-4 disabled:opacity-50"
                data-testid="submit-btn"
              >
                {updating 
                  ? (showPasswordSection ? 'Updating Profile & Password...' : 'Updating Profile...') 
                  : (showPasswordSection ? 'Update Profile & Password' : 'Update Profile')
                }
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={updating}
                className="btn-neutral py-2 px-4 disabled:opacity-50"
                data-testid="reset-btn"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
