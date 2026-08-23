import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Plus, Edit2, Trash2, Trophy, MessageSquare, ThumbsUp, ArrowLeft, Sparkles, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Persona } from "@shared/schema";

interface PersonaWithStats extends Persona {
  totalDebates: number;
  wins: number;
  totalArguments: number;
  totalVotesReceived: number;
}

export default function Personas() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<PersonaWithStats | null>(null);
  const [formData, setFormData] = useState({ name: "", tone: "", bias: "" });

  const { data: personas, isLoading } = useQuery<PersonaWithStats[]>({
    queryKey: ["/api/personas"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; tone: string; bias: string }) => {
      const res = await apiRequest("POST", "/api/personas", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setIsCreateOpen(false);
      setFormData({ name: "", tone: "", bias: "" });
      toast({ title: "Persona Created", description: "Your new persona is ready to debate!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create persona", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; tone: string; bias: string }) => {
      const res = await apiRequest("PATCH", `/api/personas/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setEditingPersona(null);
      toast({ title: "Persona Updated", description: "Changes saved successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update persona", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/personas/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      toast({ title: "Persona Deleted", description: "Persona has been removed" });
    },
    onError: () => {
      toast({ 
        title: "Cannot Delete", 
        description: "This persona is used in existing debates and cannot be deleted", 
        variant: "destructive" 
      });
    },
  });

  const handleCreate = () => {
    if (!formData.name || !formData.tone || !formData.bias) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingPersona) return;
    updateMutation.mutate({
      id: editingPersona.id,
      name: formData.name || editingPersona.name,
      tone: formData.tone || editingPersona.tone,
      bias: formData.bias || editingPersona.bias,
    });
  };

  const openEdit = (persona: PersonaWithStats) => {
    setEditingPersona(persona);
    setFormData({ name: persona.name, tone: persona.tone, bias: persona.bias });
  };

  const getWinRate = (persona: PersonaWithStats) => {
    if (persona.totalDebates === 0) return 0;
    return Math.round((persona.wins / persona.totalDebates) * 100);
  };

  const getPersonaGradient = (name: string) => {
    const hash = name.split("").reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const gradients = [
      "from-blue-500/20 to-purple-500/20",
      "from-green-500/20 to-teal-500/20",
      "from-orange-500/20 to-red-500/20",
      "from-pink-500/20 to-rose-500/20",
      "from-indigo-500/20 to-blue-500/20",
      "from-amber-500/20 to-orange-500/20",
    ];
    return gradients[hash % gradients.length];
  };

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-br from-pink-500/5 via-background to-purple-500/5 border-b">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/20">
                <Users className="w-7 h-7 text-pink-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
                <p className="text-muted-foreground">
                  Create and manage AI debate personalities
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="outline" className="gap-2" data-testid="button-back-home">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 shadow-lg" data-testid="button-create-persona">
                    <Plus className="w-4 h-4" />
                    Create Persona
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Create New Persona
                    </DialogTitle>
                    <DialogDescription>
                      Design an AI personality with unique debate characteristics
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Professor Smith"
                        data-testid="input-persona-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tone">Tone & Style</Label>
                      <Input
                        id="tone"
                        value={formData.tone}
                        onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                        placeholder="e.g., Academic and thoughtful"
                        data-testid="input-persona-tone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bias">Perspective & Bias</Label>
                      <Textarea
                        id="bias"
                        value={formData.bias}
                        onChange={(e) => setFormData({ ...formData, bias: e.target.value })}
                        placeholder="e.g., Believes in evidence-based reasoning and scientific method"
                        className="min-h-[80px]"
                        data-testid="input-persona-bias"
                      />
                    </div>
                    <Button 
                      onClick={handleCreate} 
                      className="w-full"
                      disabled={createMutation.isPending}
                      data-testid="button-submit-create"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Persona"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : personas && personas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {personas.map((persona) => {
              const winRate = getWinRate(persona);
              return (
                <Card key={persona.id} className="relative overflow-hidden group" data-testid={`card-persona-${persona.id}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${getPersonaGradient(persona.name)} opacity-50`} />
                  <CardHeader className="relative pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getPersonaGradient(persona.name)} border flex items-center justify-center shrink-0`}>
                          <span className="text-xl font-bold">
                            {persona.name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-lg truncate">{persona.name}</CardTitle>
                          <CardDescription className="truncate">{persona.tone}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(persona)}
                          data-testid={`button-edit-${persona.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-delete-${persona.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Persona?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete {persona.name}. Personas used in debates cannot be deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(persona.id)}
                                data-testid={`button-confirm-delete-${persona.id}`}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{persona.bias}</p>
                    
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded-lg bg-background/50">
                        <MessageSquare className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                        <p className="text-sm font-semibold">{persona.totalDebates}</p>
                        <p className="text-[10px] text-muted-foreground">Debates</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-background/50">
                        <Trophy className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
                        <p className="text-sm font-semibold">{persona.wins}</p>
                        <p className="text-[10px] text-muted-foreground">Wins</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-background/50">
                        <MessageSquare className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                        <p className="text-sm font-semibold">{persona.totalArguments}</p>
                        <p className="text-[10px] text-muted-foreground">Args</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-background/50">
                        <ThumbsUp className="w-4 h-4 mx-auto text-green-500 mb-1" />
                        <p className="text-sm font-semibold">{persona.totalVotesReceived}</p>
                        <p className="text-[10px] text-muted-foreground">Votes</p>
                      </div>
                    </div>

                    {persona.totalDebates > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-yellow-500" />
                            <span className="text-muted-foreground">Win Rate</span>
                          </div>
                          <span className="font-semibold">{winRate}%</span>
                        </div>
                        <Progress value={winRate} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-16 text-center border-dashed">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold">No Personas Yet</h3>
              <p className="text-muted-foreground">
                Create unique AI personalities to participate in structured debates
              </p>
              <Button onClick={() => setIsCreateOpen(true)} size="lg" className="mt-4" data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Create First Persona
              </Button>
            </div>
          </Card>
        )}

        <Dialog open={!!editingPersona} onOpenChange={(open) => !open && setEditingPersona(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                Edit Persona
              </DialogTitle>
              <DialogDescription>
                Update the personality characteristics
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tone">Tone & Style</Label>
                <Input
                  id="edit-tone"
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  data-testid="input-edit-tone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bias">Perspective & Bias</Label>
                <Textarea
                  id="edit-bias"
                  value={formData.bias}
                  onChange={(e) => setFormData({ ...formData, bias: e.target.value })}
                  className="min-h-[80px]"
                  data-testid="input-edit-bias"
                />
              </div>
              <Button 
                onClick={handleUpdate} 
                className="w-full"
                disabled={updateMutation.isPending}
                data-testid="button-submit-edit"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
