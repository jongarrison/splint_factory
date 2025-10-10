/**
 * Centralized validation constants for the application
 * This ensures consistency across frontend validation, API validation, and schemas
 */

/**
 * Pattern for validating InputName fields in geometry parameters
 * Allows: lowercase letters (a-z), digits (0-9), and dashes (-)
 * 
 * Used in:
 * - Frontend form validation
 * - API route validation
 * - JSON schema validation
 * - Type validation helpers
 */
export const INPUT_NAME_PATTERN = /^[a-zA-Z0-9]+$/;

/**
 * String version of the pattern for use in HTML pattern attributes and JSON schemas
 */
export const INPUT_NAME_PATTERN_STRING = '^[a-zA-Z0-9]+$';

/**
 * Human-readable description of allowed characters
 */
export const INPUT_NAME_ALLOWED_CHARS = 'letters (a-z, A-Z) and numbers (0-9)';

/**
 * Validates an InputName against the pattern
 */
export function isValidInputName(name: string): boolean {
  return INPUT_NAME_PATTERN.test(name) && name.length >= 1 && name.length <= 50;
}
