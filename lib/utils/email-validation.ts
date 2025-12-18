/**
 * Email validation utility
 * Validates email format and checks for common typos
 */

// Common TLD typos that should be caught
const COMMON_TLD_TYPOS: Record<string, string> = {
  "con": "com",
  "cpm": "com",
  "cm": "com",
  "c0m": "com",
  "om": "com",
  "cmo": "com",
  "ocm": "com",
};

// Valid TLDs (common ones)
const VALID_TLDS = [
  "com",
  "org",
  "net",
  "edu",
  "gov",
  "io",
  "co",
  "ai",
  "app",
  "dev",
  "tech",
  "info",
  "biz",
  "me",
  "tv",
  "cc",
  "ws",
  "name",
  "mobi",
  "asia",
  "tel",
  "travel",
  "jobs",
  "xxx",
  "pro",
  "museum",
  "aero",
  "coop",
  "mil",
  "int",
  "uk",
  "us",
  "ca",
  "au",
  "de",
  "fr",
  "jp",
  "cn",
  "in",
  "br",
  "mx",
  "ru",
  "es",
  "it",
  "nl",
  "se",
  "no",
  "dk",
  "fi",
  "pl",
  "cz",
  "ie",
  "nz",
  "sg",
  "hk",
  "kr",
  "tw",
  "th",
  "ph",
  "id",
  "my",
  "vn",
  "tr",
  "sa",
  "ae",
  "il",
  "za",
  "eg",
  "ng",
  "ke",
  "ma",
  "ar",
  "cl",
  "co",
  "pe",
  "ve",
  "ec",
  "uy",
  "py",
  "bo",
  "cr",
  "pa",
  "do",
  "gt",
  "hn",
  "ni",
  "sv",
  "pr",
  "jm",
  "tt",
  "bb",
  "bz",
  "gy",
  "sr",
  "fk",
  "gs",
  "io",
  "cx",
  "nf",
  "pn",
  "sh",
  "tc",
  "vg",
  "ac",
  "ai",
  "bm",
  "bv",
  "ky",
  "ms",
  "mp",
  "pm",
  "um",
  "vi",
  "wf",
  "yt",
];

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
  normalizedEmail?: string;
}

/**
 * Validates email format and checks for common typos
 * @param email - The email address to validate
 * @returns Validation result with error messages and suggestions
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== "string") {
    return {
      isValid: false,
      error: "Email is required",
    };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return {
      isValid: false,
      error: "Email is required",
    };
  }

  // Check for basic format: must have @ and at least one character before and after
  if (!trimmedEmail.includes("@")) {
    return {
      isValid: false,
      error: "Email must contain an @ symbol",
    };
  }

  const parts = trimmedEmail.split("@");
  if (parts.length !== 2) {
    return {
      isValid: false,
      error: "Email must contain exactly one @ symbol",
    };
  }

  const [localPart, domain] = parts;

  // Validate local part (before @)
  if (localPart.length === 0) {
    return {
      isValid: false,
      error: "Email must have characters before the @ symbol",
    };
  }

  if (localPart.length > 64) {
    return {
      isValid: false,
      error: "Email local part (before @) is too long (max 64 characters)",
    };
  }

  // Check for invalid characters in local part
  const localPartRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!localPartRegex.test(localPart)) {
    return {
      isValid: false,
      error: "Email contains invalid characters",
    };
  }

  // Local part cannot start or end with a dot
  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return {
      isValid: false,
      error: "Email cannot start or end with a dot",
    };
  }

  // Local part cannot have consecutive dots
  if (localPart.includes("..")) {
    return {
      isValid: false,
      error: "Email cannot have consecutive dots",
    };
  }

  // Validate domain part (after @)
  if (domain.length === 0) {
    return {
      isValid: false,
      error: "Email must have a domain after the @ symbol",
    };
  }

  if (domain.length > 255) {
    return {
      isValid: false,
      error: "Email domain is too long (max 255 characters)",
    };
  }

  // Check for common TLD typos
  const domainLower = domain.toLowerCase();
  const domainParts = domainLower.split(".");
  const tld = domainParts.length > 0 ? domainParts[domainParts.length - 1] : "";
  
  // Check for common TLD typos (only check the actual TLD, not the full domain)
  for (const [typo, correct] of Object.entries(COMMON_TLD_TYPOS)) {
    if (tld === typo) {
      const suggestedEmail = `${localPart}@${domainParts.slice(0, -1).join(".")}.${correct}`;
      return {
        isValid: false,
        error: `Did you mean ".${correct}" instead of ".${typo}"?`,
        suggestion: suggestedEmail,
      };
    }
  }

  // Check if domain has a valid TLD (already split above)
  if (domainParts.length < 2) {
    return {
      isValid: false,
      error: "Email domain must have at least a TLD (e.g., .com)",
    };
  }
  
  // Check for common invalid TLD patterns
  if (tld.length < 2) {
    return {
      isValid: false,
      error: "Email domain TLD must be at least 2 characters",
    };
  }

  // More comprehensive email regex (RFC 5322 simplified)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmedEmail)) {
    return {
      isValid: false,
      error: "Invalid email format",
    };
  }

  // Normalize email (lowercase)
  const normalizedEmail = trimmedEmail.toLowerCase();

  return {
    isValid: true,
    normalizedEmail,
  };
}

/**
 * Checks if an email will be converted to lowercase
 * @param email - The email address to check
 * @returns true if the email contains uppercase letters
 */
export function willBeLowercased(email: string): boolean {
  return email !== email.toLowerCase();
}

