"use client";
import { cn as clsx } from '@/lib/utils';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useConfirm } from '@/components/feedback';
import { useToast } from '@/components/feedback';
import { Badge, buttonClass, Card, Skeleton } from '@/components/ui';
import { PanelHead } from '../panel';
import { ago, avatarTone, EMAIL_RE, fmtDay, initial } from '@/lib/eds';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useEds } from '../provider';

export default function TeamView() {
  const { me, team, loadTeam } = useEds();
  const sb = supabaseBrowser();
  const toast = useToast();
  const [ask, confirm] = useConfirm();
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const myEmail = me.toLowerCase();
  const T = team.data;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) { toast(false, 'Enter a valid email address.'); return; }
    if (T.some((m) => m.email.toLowerCase() === em)) { toast(false, `${em} is already on the team.`); return; }
    setAdding(true);
    const r = await sb.from('eds_admins').insert({ email: em });
    setAdding(false);
    if (r.error) { toast(false, /duplicate/i.test(r.error.message) ? 'Already on the team.' : r.error.message); return; }
    setEmail('');
    toast(true, `${em} added. They sign in to EditSimple Studio with this email.`);
    void loadTeam();
  };

  const remove = async (em: string) => {
    if (!(await confirm({ title: 'Remove team member?', text: `${em} will lose access to the EditSimple Website section immediately.`, label: 'Remove', danger: true }))) return;
    setRemoving(em);
    const r = await sb.from('eds_admins').delete().eq('email', em).select();
    setRemoving(null);
    if (r.error) { toast(false, r.error.message); return; }
    if (!r.data?.length) { toast(false, "This member can't be removed."); return; }
    toast(true, `Removed ${em}`);
    void loadTeam();
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Team</h1>
        <p className="text-sm text-muted-foreground">People who can manage the website&apos;s leads, posts and settings.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <PanelHead icon={<Users className="h-4 w-4" />} title="Members" sub={team.loaded ? `${T.length} member${T.length === 1 ? '' : 's'}` : '…'} />
          {!team.loaded ? <div className="space-y-3 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            : !T.length ? <div className="px-6 py-10 text-center text-sm text-muted-foreground">No members</div> : (
              <ul className="divide-y divide-border">
                {T.map((m) => {
                  const self = m.email.toLowerCase() === myEmail, canRemove = !self && m.role !== 'owner';
                  const sub = m.last_sign_in ? `Last signed in ${ago(m.last_sign_in)}` : `Added ${fmtDay(m.added_at)}${m.added_by && m.added_by !== m.email ? ` by ${m.added_by}` : ''}`;
                  return (
                    <li key={m.email} className="flex items-center gap-3 px-5 py-3.5">
                      <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold', avatarTone(m.email))}>{initial(m.email)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m.email}{self && <span className="font-normal text-muted-foreground"> (you)</span>}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {m.role === 'owner' ? <Badge tone="accent">Owner</Badge> : <Badge>Admin</Badge>}
                          {!m.has_account ? <Badge tone="warn">Invited · no account yet</Badge> : !m.confirmed ? <Badge tone="warn">Email not confirmed</Badge> : <Badge dot tone="good">Active</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
                      </div>
                      {canRemove && <button className={buttonClass('outline', 'sm', 'text-rose-600 hover:bg-rose-50')} disabled={removing === m.email} onClick={() => remove(m.email)}>{removing === m.email && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Remove</button>}
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>
        <Card className="h-fit p-5">
          <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-accent" /><b className="text-sm font-semibold">Add a team member</b></div>
          <p className="mt-1 text-xs text-muted-foreground">They get full access to the website&apos;s leads, posts and settings. They sign in to EditSimple Studio with the same email. If they don&apos;t have a login yet, they create one on the sign-in page using that email.</p>
          <form onSubmit={add} noValidate className="mt-3 flex gap-2">
            <input className="input flex-1" type="email" placeholder="name@example.com" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className={buttonClass('accent')} type="submit" disabled={adding}>{adding && <Loader2 className="h-4 w-4 animate-spin" />}Add</button>
          </form>
        </Card>
      </div>
      {ask}
    </>
  );
}
