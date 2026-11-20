import type { ReactNode } from "react";

/** Card header used across the Website screens. */
export function PanelHead({ title, sub, action, icon }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
      <div className="flex min-w-0 items-start gap-2">
        {icon && <span className="mt-0.5 text-accent">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
