import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  useRouter,
  HeadContent,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { WeatherProvider } from "@/contexts/WeatherContext";
import { RiskWarningsProvider } from "@/contexts/RiskWarningsContext";
import { OfficialWarningsProvider } from "@/contexts/OfficialWarningsContext";
import { SynoptikAnalysisProvider } from "@/contexts/SynoptikAnalysisContext";
import { AppShell } from "@/components/AppShell";
import { SplashScreen } from "@/components/SplashScreen";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import { ErrorSplash } from "@/components/errors/ErrorSplash";

function NotFoundComponent() {
  return <ErrorSplash type="404" />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <ErrorSplash
      type="generic"
      error={error}
      onReset={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { title: "MeteoFlo · Wetter für DACH & Italien" },
      { name: "description", content: "Detailliertes Wetter, KI-Synoptik und Warnungen für DACH und Italien." },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="bottom-center" richColors duration={2000} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <HeadContent />
        <AppErrorBoundary>
          <WeatherProvider>
            <RiskWarningsProvider>
              <OfficialWarningsProvider>
                <SplashScreen />
                <AppShell />
                <ThemedToaster />
              </OfficialWarningsProvider>
            </RiskWarningsProvider>
          </WeatherProvider>
        </AppErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
