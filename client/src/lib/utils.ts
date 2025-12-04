import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format crypto prices with appropriate decimal places
 * Handles tiny prices like PEPE ($0.00001234) correctly
 */
export function formatCryptoPrice(price: number): string {
  if (price === 0 || isNaN(price)) return "$0.00";
  
  const absPrice = Math.abs(price);
  
  if (absPrice >= 10000) {
    return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (absPrice >= 1000) {
    return price.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  if (absPrice >= 1) {
    return price.toFixed(2);
  }
  if (absPrice >= 0.01) {
    return price.toFixed(4);
  }
  if (absPrice >= 0.0001) {
    return price.toFixed(6);
  }
  if (absPrice >= 0.000001) {
    return price.toFixed(8);
  }
  
  // For extremely small prices (like some meme tokens)
  // Use scientific notation or show significant digits
  const significantDigits = price.toPrecision(4);
  
  // Check if we should use subscript notation (0.0₅1234 style)
  const str = absPrice.toString();
  const match = str.match(/^0\.0+/);
  if (match) {
    const zerosCount = match[0].length - 2; // subtract "0."
    if (zerosCount >= 4) {
      // Format as 0.0{subscript}xxxx
      const afterZeros = str.slice(match[0].length);
      const digits = afterZeros.slice(0, 4);
      return `0.0\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089`.charAt(zerosCount % 10 + 1) ? 
        `0.0{${zerosCount}}${digits}` : significantDigits;
    }
  }
  
  return significantDigits;
}
