"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* shadcn/ui-style primitives, kept in one file for the MVP. */

type BtnVariant = "default" | "accent" | "outline" | "ghost" | "destructive" | "secondary";
const btn: Record<BtnVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  outline: "border bg-card hover:bg-secondary",
  ghost: "hover:bg-secondary",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" | "icon"; loading?: boolean }
>(({ className, variant = "default", size = "md", loading, disabled, children, ...p }, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
      size === "sm" && "h-8 px-3 text-sm",
      size === "md" && "h-10 px-4 text-sm",
      size === "lg" && "h-12 px-6 text-base",
      size === "icon" && "h-9 w-9",
      btn[variant],
      className
    )}
    {...p}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
));
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cn("flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    {...p}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea
    ref={ref}
    className={cn("flex min-h-[80px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    {...p}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select
    ref={ref}
    className={cn("flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    {...p}
  />
));
Select.displayName = "Select";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium leading-none", className)} {...p} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow-[0_1px_0_hsl(var(--border))]", className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...p} />;
}

export function Badge({ className, tone = "default", ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "real" | "ai" | "warn" | "muted" | "good" | "bad" }) {
  const tones = {
    default: "bg-secondary text-secondary-foreground",
    real: "bg-emerald-100 text-emerald-900",
    ai: "bg-violet-100 text-violet-900",
    warn: "bg-amber-100 text-amber-900",
    muted: "bg-muted text-muted-foreground",
    good: "bg-emerald-100 text-emerald-900",
    bad: "bg-rose-100 text-rose-900",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)} {...p} />;
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ErrorBanner({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
      <span>{error}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="grain flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="max-w-md text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground", className)} />;
}
