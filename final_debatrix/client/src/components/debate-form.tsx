import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const debateFormSchema = z.object({
  topic: z.string().min(10, "Topic must be at least 10 characters"),
  personaAName: z.string().min(1, "Persona A name is required"),
  personaATone: z.string().min(1, "Persona A tone is required"),
  personaABias: z.string().min(1, "Persona A bias is required"),
  personaBName: z.string().min(1, "Persona B name is required"),
  personaBTone: z.string().min(1, "Persona B tone is required"),
  personaBBias: z.string().min(1, "Persona B bias is required"),
  totalRounds: z.number().min(1).max(10),
});

type DebateFormData = z.infer<typeof debateFormSchema>;

interface DebateFormProps {
  onSubmit: (data: DebateFormData) => void;
  isSubmitting?: boolean;
}

export function DebateForm({ onSubmit, isSubmitting }: DebateFormProps) {
  const form = useForm<DebateFormData>({
    resolver: zodResolver(debateFormSchema),
    defaultValues: {
      topic: "",
      personaAName: "",
      personaATone: "",
      personaABias: "",
      personaBName: "",
      personaBTone: "",
      personaBBias: "",
      totalRounds: 3,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="topic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Debate Topic</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., Should governments regulate artificial intelligence development?"
                  className="min-h-32 resize-none text-base"
                  data-testid="input-debate-topic"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A clear, thought-provoking question or statement
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalRounds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of Rounds</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(parseInt(value))}
                defaultValue={field.value.toString()}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-rounds">
                    <SelectValue placeholder="Select rounds" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1">1 Round</SelectItem>
                  <SelectItem value="3">3 Rounds</SelectItem>
                  <SelectItem value="5">5 Rounds</SelectItem>
                  <SelectItem value="7">7 Rounds</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Persona A</h3>
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="personaAName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Progressive Advocate"
                      data-testid="input-persona-a-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="personaATone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tone</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Passionate and optimistic"
                      data-testid="input-persona-a-tone"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="personaABias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ideological Bias</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe their perspective and stance..."
                      className="resize-none"
                      data-testid="input-persona-a-bias"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Persona B</h3>
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="personaBName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Conservative Guardian"
                      data-testid="input-persona-b-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="personaBTone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tone</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Measured and cautious"
                      data-testid="input-persona-b-tone"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="personaBBias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ideological Bias</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe their perspective and stance..."
                      className="resize-none"
                      data-testid="input-persona-b-bias"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
          data-testid="button-start-debate"
        >
          {isSubmitting ? "Starting Debate..." : "Start Debate"}
        </Button>
      </form>
    </Form>
  );
}
