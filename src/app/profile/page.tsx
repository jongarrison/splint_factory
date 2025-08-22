'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/useProfile';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    
    // Validate password fields if changing password
    if (showPasswordSection) {
      if (!passwordData.currentPassword || !passwordData.newPassword) {
        return; // Form validation will handle this
      }
      
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        // You could set an error state here
        return;
      }
      
      if (passwordData.newPassword.length < 6) {
        // You could set an error state here
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
          <div className="text-red-600 text-center">
            <p className="font-semibold">Error loading profile</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <Link 
            href="/" 
            className="mt-4 block text-center bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to Home
            </Link>
          </div>

          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Organization Information */}
            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">
                Organization
              </label>
              <input
                type="text"
                id="organization"
                value={profile?.organization?.name || 'No organization assigned'}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-600 bg-gray-50 cursor-not-allowed"
              />
              {profile?.organization?.description && (
                <p className="mt-1 text-sm text-gray-500">{profile.organization.description}</p>
              )}
            </div>

            {/* Role Information */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                id="role"
                value={profile?.role ? profile.role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : 'Member'}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-600 bg-gray-50 cursor-not-allowed"
              />
            </div>

            {/* Password Section */}
            <div className="border-t pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Password</h3>
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
                </button>
              </div>

              {showPasswordSection && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={showPasswordSection}
                    />
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      minLength={6}
                      required={showPasswordSection}
                    />
                    <p className="text-sm text-gray-500 mt-1">Must be at least 6 characters long</p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300'
                      }`}
                      required={showPasswordSection}
                    />
                    {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="text-sm text-red-600 mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {profile && (
              <div className="text-sm text-gray-600">
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
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
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
