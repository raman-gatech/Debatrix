import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Argument, Persona } from "@shared/schema";

interface ArgumentCardProps {
  argument: Argument & {
    persona: Persona;
    voteCount?: number;
    hasVoted?: boolean;
  };
  side: "A" | "B";
  onVote?: (argumentId: string) => void;
  isVoting?: boolean;
}

export function ArgumentCard({
  argument,
  side,
  onVote,
  isVoting,
}: ArgumentCardProps) {
  const borderColor = side === "A" ? "border-l-primary" : "border-l-accent";

  return (
    <Card
      className={`p-6 border-l-4 ${borderColor} space-y-4`}
      data-testid={`card-argument-${argument.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full ${
              side === "A" ? "bg-primary/10" : "bg-accent/10"
            } flex items-center justify-center shrink-0`}
          >
            <span
              className={`text-sm font-semibold ${
                side === "A" ? "text-primary" : "text-accent-foreground"
              }`}
            >
              {argument.persona.name.charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide">
              {argument.persona.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {argument.persona.tone}
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(argument.createdAt), {
            addSuffix: true,
          })}
        </span>
      </div>

      <p className="text-base leading-relaxed">{argument.content}</p>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant={argument.hasVoted ? "default" : "outline"}
            size="sm"
            onClick={() => onVote?.(argument.id)}
            disabled={argument.hasVoted || isVoting}
            data-testid={`button-vote-${argument.id}`}
          >
            <ThumbsUp className="w-3 h-3 mr-1" />
            {argument.voteCount || 0}
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          Round {argument.roundNumber}
        </span>
      </div>
    </Card>
  );
}
