import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const NewDebate = lazy(() => import("@/pages/new-debate"));
const DebateRoom = lazy(() => import("@/pages/debate-room"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Personas = lazy(() => import("@/pages/personas"));

function Router() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl p-4" role="status">Loading application…</main>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/new-debate" component={NewDebate} />
        <Route path="/debate/:id" component={DebateRoom} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/personas" component={Personas} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

interface CurrentUser {
  githubId: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function AuthControls() {
  const { data } = useQuery<{ user: CurrentUser | null }>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.status === 401) return { user: null };
      if (!response.ok) throw new Error("Unable to load sign-in status");
      return response.json();
    },
  });
  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], { user: null });
      queryClient.invalidateQueries();
    },
  });

  if (!data?.user) {
    return <Button asChild variant="outline" size="sm"><a href="/api/auth/github">Sign in with GitHub</a></Button>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">{data.user.login}</span>
      <Button variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>Sign out</Button>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-end gap-3">
                <AuthControls />
                <ThemeToggle />
              </div>
            </header>
            <Router />
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
