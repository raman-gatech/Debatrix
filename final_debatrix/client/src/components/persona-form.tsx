import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPersonaSchema } from "@shared/schema";
import type { InsertPersona } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PersonaFormProps {
  onSubmit: (data: InsertPersona) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<InsertPersona>;
  submitLabel?: string;
}

export function PersonaForm({
  onSubmit,
  isSubmitting,
  defaultValues,
  submitLabel = "Create Persona",
}: PersonaFormProps) {
  const form = useForm<InsertPersona>({
    resolver: zodResolver(insertPersonaSchema),
    defaultValues: defaultValues || {
      name: "",
      tone: "",
      bias: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Persona Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Tech Optimist, Cautious Realist"
                  data-testid="input-persona-name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tone</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Professional, Passionate, Analytical"
                  data-testid="input-persona-tone"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bias"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ideological Bias</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the persona's stance and perspective..."
                  className="min-h-32 resize-none"
                  data-testid="input-persona-bias"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
          data-testid="button-submit-persona"
        >
          {isSubmitting ? "Creating..." : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
