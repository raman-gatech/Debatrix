import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import NewDebate from "@/pages/new-debate";
import DebateRoom from "@/pages/debate-room";
import Dashboard from "@/pages/dashboard";
import Personas from "@/pages/personas";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/new-debate" component={NewDebate} />
      <Route path="/debate/:id" component={DebateRoom} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/personas" component={Personas} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-end">
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
