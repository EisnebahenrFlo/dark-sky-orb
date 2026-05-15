import { createContext, useContext, type ReactNode } from "react";
import { useOfficialWarnings } from "@/hooks/useOfficialWarnings";

type Ctx = ReturnType<typeof useOfficialWarnings>;

const OfficialWarningsCtx = createContext<Ctx | null>(null);

export function OfficialWarningsProvider({ children }: { children: ReactNode }) {
  const value = useOfficialWarnings();
  return <OfficialWarningsCtx.Provider value={value}>{children}</OfficialWarningsCtx.Provider>;
}

export function useOfficialWarningsCtx() {
  const c = useContext(OfficialWarningsCtx);
  if (!c) throw new Error("useOfficialWarningsCtx must be used inside OfficialWarningsProvider");
  return c;
}
