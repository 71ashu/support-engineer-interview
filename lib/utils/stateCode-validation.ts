/**
 * Valid US state codes (50 states + District of Columbia)
 * Used for address validation in banking applications
 */
export const VALID_STATE_CODES = [
  "AL", // Alabama
  "AK", // Alaska
  "AZ", // Arizona
  "AR", // Arkansas
  "CA", // California
  "CO", // Colorado
  "CT", // Connecticut
  "DE", // Delaware
  "FL", // Florida
  "GA", // Georgia
  "HI", // Hawaii
  "ID", // Idaho
  "IL", // Illinois
  "IN", // Indiana
  "IA", // Iowa
  "KS", // Kansas
  "KY", // Kentucky
  "LA", // Louisiana
  "ME", // Maine
  "MD", // Maryland
  "MA", // Massachusetts
  "MI", // Michigan
  "MN", // Minnesota
  "MS", // Mississippi
  "MO", // Missouri
  "MT", // Montana
  "NE", // Nebraska
  "NV", // Nevada
  "NH", // New Hampshire
  "NJ", // New Jersey
  "NM", // New Mexico
  "NY", // New York
  "NC", // North Carolina
  "ND", // North Dakota
  "OH", // Ohio
  "OK", // Oklahoma
  "OR", // Oregon
  "PA", // Pennsylvania
  "RI", // Rhode Island
  "SC", // South Carolina
  "SD", // South Dakota
  "TN", // Tennessee
  "TX", // Texas
  "UT", // Utah
  "VT", // Vermont
  "VA", // Virginia
  "WA", // Washington
  "WV", // West Virginia
  "WI", // Wisconsin
  "WY", // Wyoming
  "DC", // District of Columbia
] as const;

/**
 * Type for valid state codes
 */
export type StateCode = typeof VALID_STATE_CODES[number];

/**
 * Check if a string is a valid US state code
 */
export function isValidStateCode(code: string): code is StateCode {
  return VALID_STATE_CODES.includes(code.toUpperCase() as StateCode);
}

