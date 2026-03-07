// SECURITY FIX REQUIRED — ML: Potential path traversal
// CWE: None
// Description: ML classifier detected potential path traversal (confidence: 0.55).
// TODO: Apply a proper fix for this vulnerability.
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
