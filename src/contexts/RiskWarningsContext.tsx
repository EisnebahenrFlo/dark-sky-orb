import { createContext, useContext, type ReactNode } from "react";
import { useRiskWarnings } from "@/hooks/useRiskWarnings";

type Ctx = ReturnType<typeof useRiskWarnings>;

const RiskWarningsCtx = createContext<Ctx | null>(null);

export function RiskWarningsProvider({ children }: { children: ReactNode }) {
  const value = useRiskWarnings();
  return <RiskWarningsCtx.Provider value={value}>{children}</RiskWarningsCtx.Provider>;
}

export function useRiskWarningsCtx() {
  const c = useContext(RiskWarningsCtx);
  if (!c) throw new Error("useRiskWarningsCtx must be used inside RiskWarningsProvider");
  return c;
}
