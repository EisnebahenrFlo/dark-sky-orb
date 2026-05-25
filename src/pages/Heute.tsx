import { CurrentPage } from "@/pages/Current";
import { NowcastPage } from "@/pages/Nowcast";

export function HeutePage() {
  return (
    <div className="space-y-8">
      <CurrentPage />
      <NowcastPage />
    </div>
  );
}
