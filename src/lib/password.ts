// Shared password strength validation used by register, profile, and reset flows.
// Requirements: min 8 chars, at least one uppercase, one lowercase, one number.

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Must be at least 8 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Must include a lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Must include an uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Must include a number');
  }

  return { valid: errors.length === 0, errors };
}

export const PASSWORD_REQUIREMENTS_TEXT =
  'At least 8 characters with uppercase, lowercase, and a number';
