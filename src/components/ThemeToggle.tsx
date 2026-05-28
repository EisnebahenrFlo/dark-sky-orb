import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Hell" },
  { value: "dark", icon: Moon, label: "Dunkel" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const ActiveIcon = OPTS.find((o) => o.value === theme)?.icon ?? Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Farbschema ändern"
        className="glass grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <ActiveIcon className="h-4 w-4" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {OPTS.map(({ value, icon: Icon, label }) => {
          const active = theme === value;
          return (
            <DropdownMenuItem
              key={value}
              onSelect={() => setTheme(value)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
