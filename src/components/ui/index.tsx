"use client";
import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/* shadcn/ui-style primitives for the EditSimple design system. */

type BtnVariant = "default" | "accent" | "outline" | "ghost" | "destructive" | "secondary" | "soft";
const btn: Record<BtnVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/88 shadow-[0_1px_0_rgb(255_255_255/.12)_inset,0_6px_14px_-8px_rgb(15_18_30/.6)]",
  accent: "bg-accent text-accent-foreground hover:brightness-110 shadow-[0_1px_0_rgb(255_255_255/.18)_inset,0_8px_18px_-10px_hsl(var(--accent))]",
  outline: "border bg-card hover:bg-secondary/70",
  ghost: "hover:bg-secondary",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
  soft: "bg-[hsl(var(--accent-soft))] text-accent hover:brightness-[.97]",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "xs" | "sm" | "md" | "lg" | "icon"; loading?: boolean }
>(({ className, variant = "default", size = "md", loading, disabled, children, ...p }, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
      "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-[background,box-shadow,transform,filter] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
      size === "xs" && "h-7 rounded-lg px-2.5 text-xs",
      size === "sm" && "h-8 px-3 text-[13px]",
      size === "md" && "h-10 px-4 text-sm",
      size === "lg" && "h-12 px-5 text-[15px]",
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

const field =
  "w-full rounded-[10px] border border-input bg-card text-sm shadow-[0_1px_2px_rgb(15_18_30/.04)] transition-colors placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--accent)/.12)]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, "flex h-10 px-3", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, "flex min-h-[80px] px-3 py-2.5 leading-relaxed", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(field, "flex h-10 px-3", className)} {...p} />
));
Select.displayName = "Select";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium leading-none text-foreground/90", className)} {...p} />;
}

export function Field({ label, hint, children, className, aside }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {aside}
      </div>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border bg-card text-card-foreground", className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[15px] font-semibold", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...p} />;
}

export function Badge({ className, tone = "default", ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "real" | "ai" | "warn" | "muted" | "good" | "bad" | "accent" }) {
  const tones = {
    default: "bg-secondary text-secondary-foreground",
    real: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    ai: "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
    warn: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    muted: "bg-muted text-muted-foreground",
    good: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    bad: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
    accent: "bg-[hsl(var(--accent-soft))] text-accent",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone], className)} {...p} />;
}

/** Marks AI-produced content, consistently, everywhere. */
export function AiTag({ children = "AI suggestion", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("ai-tag", className)}>
      <Sparkles className="h-3 w-3" />
      {children}
    </span>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ErrorBanner({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
      <span>{error}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card/60 px-6 py-14 text-center">
      <p className="text-xl font-semibold tracking-[-0.02em]">{title}</p>
      {children && <p className="max-w-md text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/** Segmented control. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-[11px] bg-secondary p-1", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-lg font-medium transition-all",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]",
            value === o.value ? "bg-card text-foreground shadow-[0_1px_3px_rgb(15_18_30/.12)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Clickable chip used for AI suggestions and quick picks. */
export function Chip({ children, onClick, active, className }: { children: React.ReactNode; onClick?: () => void; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[13px] transition-colors",
        active ? "border-accent bg-[hsl(var(--accent-soft))] text-accent" : "bg-card hover:border-foreground/30",
        className
      )}
    >
      {children}
    </button>
  );
}
