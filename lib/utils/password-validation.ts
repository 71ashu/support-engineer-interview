// Common weak passwords that meet complexity requirements but are still insecure
// These passwords have uppercase, lowercase, number, and special character but are easily guessable
// Stored in lowercase for case-insensitive comparison
const COMMON_PASSWORDS = [
  "password1!",
  "password123!",
  "welcome1!",
  "welcome123!",
  "qwerty123!",
  "qwerty1!",
  "admin123!",
  "admin1!",
  "passw0rd!",
  "passw0rd123!",
  "sunshine1!",
  "princess1!",
  "dragon123!",
  "letmein1!",
  "monkey123!",
];

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates password strength according to security requirements.
 * Password must:
 * - Be at least 8 characters long
 * - Contain at least one uppercase letter
 * - Contain at least one lowercase letter
 * - Contain at least one number
 * - Contain at least one special character
 * - Not be a common/weak password
 *
 * @param password - The password to validate
 * @returns Validation result with isValid flag and optional error message
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters long",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one uppercase letter",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }

  if (!/\d/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one number",
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)",
    };
  }

  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return {
      isValid: false,
      error: "Password is too common. Please choose a more secure password",
    };
  }

  return { isValid: true };
}

