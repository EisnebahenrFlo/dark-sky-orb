export type RiskColorKey = "green" | "yellow" | "orange" | "red" | "purple";

export const colorClasses: Record<
  RiskColorKey,
  { border: string; bg: string; text: string }
> = {
  green: {
    border: "border-green-500",
    bg: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
  },
  yellow: {
    border: "border-yellow-500",
    bg: "bg-yellow-500/10",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  orange: {
    border: "border-orange-500",
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
  },
  red: {
    border: "border-red-500",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
  purple: {
    border: "border-purple-500",
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
  },
};
