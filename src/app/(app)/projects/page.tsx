"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button, Empty, ErrorBanner, Input, Skeleton } from "@/components/ui";
import { ProjectCard, type ProjectListItem } from "@/components/project-card";
import { api } from "@/lib/api-client";

export default function ProjectsPage() {
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = () => api<{ projects: ProjectListItem[] }>("/api/projects").then((r) => setItems(r.projects)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const shown = (items ?? []).filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="My projects"
        subtitle="Drafts resume where they stopped."
        actions={<Link href="/create"><Button variant="accent"><Plus className="h-4 w-4" />New carousel</Button></Link>}
      />
      <ErrorBanner error={error} onRetry={() => { setError(null); load(); }} />
      {items === null && !error ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
      ) : items && items.length === 0 ? (
        <Empty title="No carousels yet" action={<Link href="/create"><Button className="mt-3">Create your first</Button></Link>}>
          Start with a topic — EditSimple researches keywords, writes the slides and renders them.
        </Empty>
      ) : (
        <>
          <Input className="mb-5 max-w-sm" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => <ProjectCard key={p.id} p={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
