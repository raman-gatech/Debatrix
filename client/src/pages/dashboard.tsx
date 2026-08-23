import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BarChart3, Users, MessageSquare, ThumbsUp, Trophy, TrendingUp, Activity, ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalDebates: number;
  activeDebates: number;
  completedDebates: number;
  totalArguments: number;
  totalVotes: number;
  totalPersonas: number;
}

interface TrendingWord {
  word: string;
  count: number;
}

interface RecentActivity {
  id: string;
  topic: string;
  status: string;
  createdAt: string;
  personaA: string;
  personaB: string;
}

const statCards = [
  { key: "totalDebates", label: "Total Debates", icon: MessageSquare, color: "text-primary", bgColor: "bg-primary/10" },
  { key: "activeDebates", label: "Active", icon: Activity, color: "text-green-500", bgColor: "bg-green-500/10" },
  { key: "completedDebates", label: "Completed", icon: Trophy, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { key: "totalArguments", label: "Arguments", icon: MessageSquare, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { key: "totalVotes", label: "Votes", icon: ThumbsUp, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { key: "totalPersonas", label: "Personas", icon: Users, color: "text-pink-500", bgColor: "bg-pink-500/10" },
] as const;

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/analytics/stats"],
  });

  const { data: trending, isLoading: trendingLoading } = useQuery<TrendingWord[]>({
    queryKey: ["/api/analytics/trending"],
  });

  const { data: activity, isLoading: activityLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/analytics/activity"],
  });

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/5 via-background to-purple-500/5 border-b">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
                <BarChart3 className="w-7 h-7 text-blue-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                  Platform analytics and performance metrics
                </p>
              </div>
            </div>
            <Link href="/">
              <Button variant="outline" className="gap-2" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4" />
                Back to Debates
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          ) : (
            statCards.map((stat) => {
              const Icon = stat.icon;
              const value = stats?.[stat.key] || 0;
              return (
                <Card key={stat.key} className="relative overflow-hidden" data-testid={`card-stat-${stat.key}`}>
                  <div className={`absolute top-0 right-0 w-20 h-20 ${stat.bgColor} rounded-full -translate-y-1/2 translate-x-1/2 opacity-50`} />
                  <CardContent className="pt-6 relative">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-trending-topics">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle>Trending Topics</CardTitle>
                  <CardDescription>Most discussed themes across debates</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trendingLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24" />
                  ))}
                </div>
              ) : trending && trending.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {trending.map((item, index) => (
                    <Badge
                      key={item.word}
                      variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"}
                      className="text-sm py-1.5 px-3"
                      data-testid={`badge-trending-${index}`}
                    >
                      <Sparkles className={`w-3 h-3 mr-1.5 ${index === 0 ? "" : "opacity-50"}`} />
                      {item.word}
                      <span className="ml-1.5 opacity-60 text-xs">({item.count})</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No trending topics yet. Start some debates!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-recent-activity">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Activity className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest debate updates</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="space-y-2">
                  {activity.map((debate) => (
                    <Link key={debate.id} href={`/debate/${debate.id}`}>
                      <div 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate cursor-pointer transition-all" 
                        data-testid={`activity-item-${debate.id}`}
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium truncate">{debate.topic}</p>
                          <p className="text-xs text-muted-foreground">
                            {debate.personaA} vs {debate.personaB}
                          </p>
                        </div>
                        <Badge 
                          variant={debate.status === "active" ? "default" : debate.status === "paused" ? "secondary" : "outline"}
                          className="ml-3 shrink-0"
                        >
                          {debate.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                          {debate.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No recent activity. Start your first debate!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
