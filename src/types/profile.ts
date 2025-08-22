// User profile types
export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role?: string;
  organizationId?: string | null;
  organization?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  createdAt: Date;
  updatedAt?: Date;
}

export interface UpdateProfileData {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

// API response types
export interface ProfileResponse {
  id: string;
  name: string | null;
  email: string;
  role?: string;
  organizationId?: string | null;
  organization?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  createdAt: string; // Date as ISO string from API
  updatedAt?: string;
}

export interface ApiError {
  error: string;
}
