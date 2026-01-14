import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Swords, Clock, Pause } from "lucide-react";
import { Link } from "wouter";
import type { Debate, Persona } from "@shared/schema";

interface DebateCardProps {
  debate: Debate & {
    personaA: Persona;
    personaB: Persona;
    argumentCount?: number;
    spectatorCount?: number;
  };
}

export function DebateCard({ debate }: DebateCardProps) {
  const isActive = debate.status === "active";
  const isPaused = debate.status === "paused";
  const isCompleted = debate.status === "completed";

  const getStatusBadge = () => {
    if (isActive) {
      return (
        <Badge variant="default" className="shrink-0 gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </Badge>
      );
    }
    if (isPaused) {
      return (
        <Badge variant="secondary" className="shrink-0 gap-1.5">
          <Pause className="w-3 h-3" />
          Paused
        </Badge>
      );
    }
    if (isCompleted) {
      return (
        <Badge variant="outline" className="shrink-0">
          Completed
        </Badge>
      );
    }
    return null;
  };

  return (
    <Link href={`/debate/${debate.id}`}>
      <Card
        className="relative overflow-hidden hover-elevate active-elevate-2 cursor-pointer transition-all duration-200"
        data-testid={`card-debate-${debate.id}`}
      >
        {isActive && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/50 to-primary animate-pulse" />
        )}
        
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-snug line-clamp-2 flex-1">
              {debate.topic}
            </h3>
            {getStatusBadge()}
          </div>

          <div className="flex items-center justify-center gap-3 py-3">
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {debate.personaA.name.charAt(0)}
                </span>
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="text-sm font-medium truncate">
                  {debate.personaA.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {debate.personaA.tone}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Swords className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center">
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {debate.personaB.name.charAt(0)}
                </span>
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="text-sm font-medium truncate">
                  {debate.personaB.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {debate.personaB.tone}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{debate.argumentCount || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Round {debate.currentRound}/{debate.totalRounds}</span>
              </div>
            </div>
            {debate.winnerId && (
              <Badge variant="secondary" className="text-xs">
                Winner: {debate.winnerId === debate.personaAId ? debate.personaA.name : debate.personaB.name}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
