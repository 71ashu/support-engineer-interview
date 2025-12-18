/**
 * Validates a credit card number using the Luhn algorithm
 * @param cardNumber - The card number to validate (should already be cleaned, digits only)
 * @returns true if the card number is valid according to Luhn algorithm
 */
function validateLuhn(cardNumber: string): boolean {
  // Must be all digits
  if (!/^\d+$/.test(cardNumber)) {
    return false;
  }
  
  // Card numbers are typically 13-19 digits
  if (cardNumber.length < 13 || cardNumber.length > 19) {
    return false;
  }
  
  let sum = 0;
  let isEven = false;
  
  // Process from right to left
  // Double every second digit starting from the second-to-last digit
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);
    
    if (isEven) {
      digit *= 2;
      // If doubling results in a two-digit number, subtract 9 (equivalent to adding digits)
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  // Valid if sum is divisible by 10
  return sum % 10 === 0;
}

/**
 * Validates a credit card number format and checksum
 * @param cardNumber - The card number to validate (can include spaces or dashes)
 * @returns true if valid, false otherwise
 */
export function isValidCardNumber(cardNumber: string): boolean {
  if (!cardNumber || typeof cardNumber !== "string") {
    return false;
  }
  
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/\s|-/g, "");
  
  // Must be 13-19 digits (standard card number lengths)
  // Visa: 13 or 16, Mastercard: 16, Amex: 15, Discover: 16, etc.
  if (!/^\d{13,19}$/.test(cleaned)) {
    return false;
  }
  
  // Validate using Luhn algorithm
  return validateLuhn(cleaned);
}

