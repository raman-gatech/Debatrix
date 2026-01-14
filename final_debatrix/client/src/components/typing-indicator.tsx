export function TypingIndicator({ personaName }: { personaName: string }) {
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-lg bg-muted/50"
      data-testid="typing-indicator"
    >
      <div className="flex gap-1">
        <div
          className="w-2 h-2 rounded-full bg-primary animate-pulse"
          style={{ animationDelay: "0ms" }}
        />
        <div
          className="w-2 h-2 rounded-full bg-primary animate-pulse"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="w-2 h-2 rounded-full bg-primary animate-pulse"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span className="text-sm text-muted-foreground">
        {personaName} is thinking...
      </span>
    </div>
  );
}
