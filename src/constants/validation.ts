/**
 * Centralized validation constants for the application
 * This ensures consistency across frontend validation, API validation, and schemas
 */

/**
 * Pattern for validating InputName fields in geometry parameters
 * Allows: lowercase letters (a-z), uppercase letters (A-Z), digits (0-9), and underscores (_)
 * 
 * Used in:
 * - Frontend form validation
 * - API route validation
 * - JSON schema validation
 * - Type validation helpers
 */
export const INPUT_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * String version of the pattern for use in HTML pattern attributes and JSON schemas
 */
export const INPUT_NAME_PATTERN_STRING = '^[a-zA-Z0-9_]+$';

/**
 * Human-readable description of allowed characters
 */
export const INPUT_NAME_ALLOWED_CHARS = 'letters (a-z, A-Z), numbers (0-9), and underscores (_)';

/**
 * Validates an InputName against the pattern
 */
export function isValidInputName(name: string): boolean {
  return INPUT_NAME_PATTERN.test(name) && name.length >= 1 && name.length <= 50;
}
