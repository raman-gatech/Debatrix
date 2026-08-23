import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Sparkles, BarChart3, Users, Search, Filter, Zap, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DebateCard } from "@/components/debate-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Debate, Persona } from "@shared/schema";

export default function Home() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (sortBy !== "newest") queryParams.set("sortBy", sortBy);
  const queryString = queryParams.toString();
  const apiUrl = queryString ? `/api/debates?${queryString}` : "/api/debates";

  const { data: debates, isLoading } = useQuery<
    (Debate & {
      personaA: Persona;
      personaB: Persona;
      argumentCount: number;
      spectatorCount: number;
    })[]
  >({
    queryKey: [apiUrl],
  });

  const activeCount = debates?.filter(d => d.status === "active").length || 0;
  const completedCount = debates?.filter(d => d.status === "completed").length || 0;

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 border-b">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="max-w-7xl mx-auto px-4 py-12 relative">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight">Debatrix</h1>
                  <p className="text-muted-foreground">
                    AI-powered structured debates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-muted-foreground">{activeCount} active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">{completedCount} completed</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2" data-testid="button-dashboard">
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/personas">
                <Button variant="outline" className="gap-2" data-testid="button-personas">
                  <Users className="w-4 h-4" />
                  Personas
                </Button>
              </Link>
              <Link href="/new-debate">
                <Button size="lg" className="gap-2 shadow-lg" data-testid="button-new-debate">
                  <Zap className="w-4 h-4" />
                  Start Debate
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search debates by topic or persona..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-background"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-status">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px]" data-testid="select-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="arguments">Most Arguments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            {statusFilter === "all" ? "All Debates" : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Debates`}
            {debates && (
              <Badge variant="secondary" className="ml-2">
                {debates.length}
              </Badge>
            )}
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : debates && debates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {debates.map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}
          </div>
        ) : (
          <Card className="p-16 text-center border-dashed">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">No debates found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Create your first AI debate and watch personas argue their perspectives"}
              </p>
              <Link href="/new-debate">
                <Button size="lg" className="mt-4" data-testid="button-start-first-debate">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Debate
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
