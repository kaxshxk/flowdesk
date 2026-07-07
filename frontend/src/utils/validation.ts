// Shared Email Validation Regex supporting plus addressing, subdomains, and international TLDs.
// Rejects consecutive, leading, or trailing dots.
export const EMAIL_REGEX = /^(?!\.)(?!.*\.\.)[a-zA-Z0-9._%+-]+@(?!\.)(?!.*\.\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed.includes("@")) return false;
  
  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;
  
  const domain = parts[1];
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  
  return EMAIL_REGEX.test(trimmed);
}
