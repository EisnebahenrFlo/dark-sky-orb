import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function haptic(type: "light" | "medium" = "light") {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(type === "light" ? 30 : 60);
  }
}
