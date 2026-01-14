import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Users, Trophy, Play, Pause, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArgumentCard } from "@/components/argument-card";
import { TypingIndicator } from "@/components/typing-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Debate, Persona, Argument } from "@shared/schema";

export default function DebateRoom() {
  const [, params] = useRoute("/debate/:id");
  const debateId = params?.id;
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [votedArguments, setVotedArguments] = useState<Set<string>>(new Set());
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingPersona, setTypingPersona] = useState<string>("");

  const { data: debate, isLoading } = useQuery<
    Debate & {
      personaA: Persona;
      personaB: Persona;
    }
  >({
    queryKey: ["/api/debates", debateId],
    enabled: !!debateId,
  });

  const { data: argumentsData } = useQuery<
    {
      debateArguments: (Argument & {
        persona: Persona;
        voteCount: number;
      })[];
    }
  >({
    queryKey: ["/api/debates", debateId, "arguments"],
    enabled: !!debateId,
    refetchInterval: 2000,
  });

  const voteMutation = useMutation({
    mutationFn: async (argumentId: string) => {
      const fingerprint = localStorage.getItem("voterFingerprint") || 
        Math.random().toString(36).substring(7);
      localStorage.setItem("voterFingerprint", fingerprint);

      const response = await apiRequest("POST", "/api/votes", {
        argumentId,
        debateId,
        voterFingerprint: fingerprint,
      });
      return await response.json();
    },
    onSuccess: (_, argumentId) => {
      setVotedArguments((prev) => new Set(prev).add(argumentId));
      queryClient.invalidateQueries({ queryKey: ["/api/debates", debateId, "arguments"] });
      toast({
        title: "Vote Recorded",
        description: "Your vote has been counted!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const invalidateDebateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/debates", debateId] });
    queryClient.invalidateQueries({ predicate: (query) => 
      typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/debates")
    });
  };

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/debates/${debateId}/pause`);
      return res.json();
    },
    onSuccess: () => {
      invalidateDebateQueries();
      toast({ title: "Debate Paused", description: "The debate has been paused" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to pause debate", variant: "destructive" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/debates/${debateId}/resume`);
      return res.json();
    },
    onSuccess: () => {
      invalidateDebateQueries();
      toast({ title: "Debate Resumed", description: "The debate is continuing" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resume debate", variant: "destructive" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/debates/${debateId}/skip`);
      return res.json();
    },
    onSuccess: () => {
      invalidateDebateQueries();
      toast({ title: "Skipping to Judgment", description: "The debate will end soon" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to skip debate", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!debateId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join", debateId }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "typing") {
        setIsTyping(true);
        setTypingPersona(data.personaName);
      } else if (data.type === "argument") {
        setIsTyping(false);
        queryClient.invalidateQueries({ queryKey: ["/api/debates", debateId, "arguments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/debates", debateId] });
      } else if (data.type === "judgment") {
        setIsTyping(false);
        queryClient.invalidateQueries({ queryKey: ["/api/debates", debateId] });
        queryClient.invalidateQueries({ queryKey: ["/api/debates", debateId, "arguments"] });
        toast({
          title: "Debate Complete!",
          description: "The AI judge has declared a winner",
        });
      } else if (data.type === "error") {
        setIsTyping(false);
        queryClient.invalidateQueries({ queryKey: ["/api/debates", debateId] });
        toast({
          title: "Debate Error",
          description: data.message,
          variant: "destructive",
        });
      } else if (data.type === "status") {
        queryClient.invalidateQueries({ queryKey: ["/api/debates", debateId] });
        if (data.status === "paused") {
          setIsTyping(false);
        }
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [debateId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [argumentsData, isTyping]);

  if (isLoading || !debate) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-16 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const debateArgs = argumentsData?.debateArguments || [];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl font-bold">{debate.topic}</h1>
                {debate.status === "active" && (
                  <Badge variant="default">Live</Badge>
                )}
                {debate.status === "paused" && (
                  <Badge variant="secondary">Paused</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Round {debate.currentRound} of {debate.totalRounds}
              </p>
            </div>
            {(debate.status === "active" || debate.status === "paused") && (
              <div className="flex items-center gap-2">
                {debate.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pauseMutation.mutate()}
                    disabled={pauseMutation.isPending}
                    data-testid="button-pause"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                    data-testid="button-resume"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Resume
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => skipMutation.mutate()}
                  disabled={skipMutation.isPending}
                  data-testid="button-skip"
                >
                  <FastForward className="w-4 h-4 mr-1" />
                  Skip to End
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div
              ref={scrollRef}
              className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto pr-2"
            >
              {debateArgs.length === 0 && !isTyping ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Debate will start shortly...
                  </p>
                </Card>
              ) : (
                <>
                  {debateArgs.map((argument) => {
                    const side =
                      argument.personaId === debate.personaAId ? "A" : "B";
                    return (
                      <div
                        key={argument.id}
                        className="animate-in slide-in-from-bottom-4 duration-300"
                      >
                        <ArgumentCard
                          argument={{
                            ...argument,
                            hasVoted: votedArguments.has(argument.id),
                          }}
                          side={side}
                          onVote={(id) => voteMutation.mutate(id)}
                          isVoting={voteMutation.isPending}
                        />
                      </div>
                    );
                  })}
                  {isTyping && <TypingIndicator personaName={typingPersona} />}
                  
                  {debate.status === "completed" && debate.judgmentSummary && (
                    <Card className="p-8 bg-primary/5 border-2 border-primary" data-testid="card-judgment">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-6 h-6 text-primary" />
                          <h3 className="text-xl font-bold">Debate Winner</h3>
                        </div>
                        {debate.winnerId && (
                          <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-md">
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                              <span className="text-primary-foreground font-bold text-lg">
                                {(debate.winnerId === debate.personaAId 
                                  ? debate.personaA.name 
                                  : debate.personaB.name).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-bold text-lg">
                                {debate.winnerId === debate.personaAId 
                                  ? debate.personaA.name 
                                  : debate.personaB.name}
                              </p>
                              <p className="text-sm text-muted-foreground">Victor</p>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <h4 className="font-semibold">Judge's Analysis</h4>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {debate.judgmentSummary}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                Debaters
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {debate.personaA.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide">
                      {debate.personaA.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {debate.personaA.tone}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {debate.personaA.bias}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-accent-foreground">
                      {debate.personaB.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide">
                      {debate.personaB.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {debate.personaB.tone}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {debate.personaB.bias}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                Stats
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Arguments
                  </span>
                  <span className="text-sm font-semibold">
                    {debateArgs.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={debate.status === "active" ? "default" : "secondary"}>
                    {debate.status}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
