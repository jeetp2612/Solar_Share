import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "bg-card text-card-foreground border-border shadow-[var(--shadow-card-hover)]",
          title: "text-foreground",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
