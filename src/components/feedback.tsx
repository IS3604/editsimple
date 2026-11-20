"use client";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/* Toasts, a side drawer and a confirm dialog — shared by the Website section. */

type Toast = { id: number; ok: boolean; text: string };
type ToastFn = (ok: boolean, text: string) => void;
const ToastCtx = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback<ToastFn>((ok, text) => {
    const id = ++seq.current;
    setList((l) => [...l.slice(-3), { id, ok, text }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), ok ? 3800 : 6500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end">
        {list.map((t) => (
          <div
            key={t.id}
            role={t.ok ? "status" : "alert"}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-2.5 rounded-xl border bg-card px-3.5 py-3 text-sm shadow-[0_18px_40px_-18px_rgb(15_18_30/.45)]"
          >
            {t.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
            <span className="min-w-0 flex-1 break-words">{t.text}</span>
            <button aria-label="Dismiss" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastFn {
  const t = useContext(ToastCtx);
  return t ?? ((ok, text) => (ok ? console.info(text) : console.warn(text)));
}

/** Full-screen on phones, a side panel on larger screens. Closes on Escape. */
export function Drawer({
  open,
  onClose,
  title,
  sub,
  icon,
  footer,
  headerExtra,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(15_18_30/.35)] backdrop-blur-[2px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn("absolute inset-y-0 right-0 flex w-full animate-fade-in flex-col border-l bg-card shadow-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <header className="flex items-center gap-3 border-b px-5 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold">{title}</h2>
            {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
          </div>
          {headerExtra}
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-2 border-t bg-card px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

type Ask = { title: string; text: string; label: string; danger?: boolean };

/** `const [dialog, confirm] = useConfirm()` → render {dialog}, then `if (await confirm({...}))`. */
export function useConfirm(): [ReactNode, (a: Ask) => Promise<boolean>] {
  const [ask, setAsk] = useState<(Ask & { done: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((a: Ask) => new Promise<boolean>((done) => setAsk({ ...a, done })), []);
  const close = (v: boolean) => {
    ask?.done(v);
    setAsk(null);
  };
  useEffect(() => {
    if (!ask) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const node =
    ask && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center">
            <div className="absolute inset-0 animate-fade-in bg-[rgb(15_18_30/.4)]" onClick={() => close(false)} />
            <div role="alertdialog" aria-modal="true" aria-labelledby="cf-title" className="relative w-full max-w-sm animate-scale-in rounded-2xl border bg-card p-5 shadow-2xl">
              <h2 id="cf-title" className="text-[15px] font-semibold">{ask.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{ask.text}</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => close(false)}>Cancel</Button>
                <Button variant={ask.danger ? "destructive" : "default"} size="sm" autoFocus onClick={() => close(true)}>{ask.label}</Button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;
  return [node, confirm];
}
