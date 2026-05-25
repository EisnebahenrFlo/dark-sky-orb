import { createContext, useContext, type ReactNode } from "react";
import { useSynoptikAnalysis } from "@/hooks/useSynoptikAnalysis";

type Ctx = ReturnType<typeof useSynoptikAnalysis>;

const SynoptikAnalysisCtx = createContext<Ctx | null>(null);

export function SynoptikAnalysisProvider({ children }: { children: ReactNode }) {
  const value = useSynoptikAnalysis();
  return (
    <SynoptikAnalysisCtx.Provider value={value}>{children}</SynoptikAnalysisCtx.Provider>
  );
}

export function useSynoptikAnalysisCtx() {
  const c = useContext(SynoptikAnalysisCtx);
  if (!c) throw new Error("useSynoptikAnalysisCtx must be used inside SynoptikAnalysisProvider");
  return c;
}
