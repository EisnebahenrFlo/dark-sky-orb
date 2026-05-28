import { type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

export function WeatherTabTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-tab-fade">
      {children}
    </div>
  );
}
