import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
      fill="none"
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <circle cx="16" cy="16" r="5.2" className="fill-primary-foreground" />
      <g className="stroke-primary-foreground" strokeWidth="1.6" strokeLinecap="round">
        <path d="M16 5.5v3.2M16 23.3v3.2M5.5 16h3.2M23.3 16h3.2" />
        <path d="M8.6 8.6l2.3 2.3M21.1 21.1l2.3 2.3M8.6 23.4l2.3-2.3M21.1 10.9l2.3-2.3" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-lg font-semibold tracking-tight text-foreground", className)}>
      SolarShare
    </span>
  );
}
