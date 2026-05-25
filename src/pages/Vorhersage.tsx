import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HourlyPage } from "@/pages/Hourly";
import { DailyPage } from "@/pages/Daily";
import { RefreshButton } from "@/components/RefreshButton";

type View = "hourly" | "daily";

export function VorhersagePage() {
  const [view, setView] = useState<View>("hourly");
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["weather"] });
  };

  return (
    <div className="relative space-y-4">
      <div className="absolute right-0 top-0 z-20">
        <RefreshButton onRefresh={handleRefresh} />
      </div>
      <div
        className="flex w-full rounded-[10px] p-[3px] pr-14"
        style={{ background: "#f0f4f8" }}
      >
        {[
          { v: "hourly" as View, label: "Stündlich" },
          { v: "daily" as View, label: "7-Tage" },
        ].map(({ v, label }) => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex-1 rounded-lg border-0 px-0 py-[7px] text-[12px] font-semibold transition-all"
              style={{
                background: active ? "white" : "transparent",
                color: active ? "#1a2a3a" : "#8a9ab0",
                boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {view === "hourly" ? <HourlyPage /> : <DailyPage />}
    </div>
  );
}
