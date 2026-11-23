"use client";
import { useCallback, useEffect, useState } from "react";
import { MailPlus, RefreshCw, ShieldCheck, Trash2, UserCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { useConfirm, useToast } from "@/components/feedback";
import { Badge, Button, Card, ErrorBanner, Input, Skeleton } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { AdminUser } from "@/app/api/admin/users/route";

type Data = { me: string; users: AdminUser[]; pendingAdmins: { email: string; role: string }[] };

const when = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const STATUS: Record<AdminUser["status"], { label: string; tone: "good" | "warn" | "muted" }> = {
  active: { label: "Active", tone: "good" },
  invited: { label: "Invite sent", tone: "warn" },
  unconfirmed: { label: "Email not confirmed", tone: "muted" },
};

export default function AdminPage() {
  const toast = useToast();
  const [dialog, confirm] = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>("/api/admin/users"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const run = async (key: string, fn: () => Promise<{ message?: string }>) => {
    setBusy(key);
    try {
      const r = await fn();
      toast(true, r.message ?? "Done");
      await load();
    } catch (e) {
      toast(false, (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    void run("invite", async () => {
      const r = await api<{ message: string }>("/api/admin/invite", { method: "POST", json: { email: addr, admin: asAdmin } });
      setEmail("");
      setAsAdmin(false);
      return r;
    });
  };

  const resend = (u: AdminUser) => run(`resend:${u.id}`, () => api("/api/admin/invite", { method: "POST", json: { email: u.email, admin: false } }));
  const setRole = (u: AdminUser, action: "make_admin" | "remove_admin") => run(`role:${u.id}`, () => api(`/api/admin/users/${u.id}`, { method: "PATCH", json: { action } }));
  const remove = async (u: AdminUser) => {
    const ok = await confirm({
      title: `Remove ${u.email}?`,
      text: "Their account and everything they created in the studio (posts, clients, research) will be deleted. This can't be undone.",
      label: "Remove account",
      danger: true,
    });
    if (ok) void run(`del:${u.id}`, () => api(`/api/admin/users/${u.id}`, { method: "DELETE" }));
  };

  const active = data?.users.filter((u) => u.status === "active").length ?? 0;
  const pending = data?.users.filter((u) => u.status !== "active").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle="Invite people to EditSimple Studio and manage who has access." />

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <MailPlus className="h-4 w-4 text-accent" />
          <h2 className="text-[15px] font-semibold">Invite someone</h2>
        </div>
        <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 sm:max-w-sm" maxLength={200} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} className="h-4 w-4 rounded accent-[hsl(var(--accent))]" />
            Also make them an admin
          </label>
          <Button type="submit" variant="accent" loading={busy === "invite"} className="sm:ml-auto">Send invite</Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">They get an email with a link to set a password. Links expire after 24 hours; you can resend from the list below.</p>
      </Card>

      <ErrorBanner error={error} />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="text-[15px] font-semibold">People</h2>
          {data && <span className="text-xs text-muted-foreground">{active} active · {pending} pending</span>}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
        </div>
        {!data && !error ? (
          <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : data && !data.users.length ? (
          <p className="p-5 text-sm text-muted-foreground">No accounts yet.</p>
        ) : data ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr><th>Email</th><th>Status</th><th>Joined / invited</th><th>Last sign-in</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const me = u.email === data.me;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.email}</span>
                          {me && <span className="text-xs text-muted-foreground">(you)</span>}
                          {u.role && <Badge tone="accent"><ShieldCheck className="h-3 w-3" />{u.role === "owner" ? "Owner" : "Admin"}</Badge>}
                        </div>
                      </td>
                      <td><Badge dot tone={STATUS[u.status].tone}>{STATUS[u.status].label}</Badge></td>
                      <td className="num text-muted-foreground">{when(u.invited_at ?? u.created_at)}</td>
                      <td className="num text-muted-foreground">{when(u.last_sign_in)}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {u.status !== "active" && (
                            <Button size="xs" variant="outline" loading={busy === `resend:${u.id}`} onClick={() => resend(u)}>Resend invite</Button>
                          )}
                          {u.role !== "owner" && !me && (
                            u.role ? (
                              <Button size="xs" variant="ghost" loading={busy === `role:${u.id}`} onClick={() => setRole(u, "remove_admin")}>Remove admin</Button>
                            ) : (
                              <Button size="xs" variant="ghost" loading={busy === `role:${u.id}`} onClick={() => setRole(u, "make_admin")}><UserCheck className="h-3.5 w-3.5" />Make admin</Button>
                            )
                          )}
                          {u.role !== "owner" && !me && (
                            <Button size="xs" variant="ghost" className="text-rose-600 hover:bg-rose-50" aria-label={`Remove ${u.email}`} loading={busy === `del:${u.id}`} onClick={() => remove(u)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {data && data.pendingAdmins.length > 0 && (
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">
            Admin access is reserved for {data.pendingAdmins.map((p) => p.email).join(", ")} — it applies once they create an account with that email.
          </p>
        )}
      </Card>
      {dialog}
    </div>
  );
}
