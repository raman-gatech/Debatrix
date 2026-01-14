import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DebateForm } from "@/components/debate-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function NewDebate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createDebateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/debates", data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Debate Created",
        description: "Your debate has been started successfully!",
      });
      setLocation(`/debate/${data.debateId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Start New Debate</h1>
            <p className="text-muted-foreground mt-1">
              Configure two AI personas and watch them debate
            </p>
          </div>
        </div>

        <Card className="p-8">
          <DebateForm
            onSubmit={(data) => createDebateMutation.mutate(data)}
            isSubmitting={createDebateMutation.isPending}
          />
        </Card>
      </div>
    </div>
  );
}
