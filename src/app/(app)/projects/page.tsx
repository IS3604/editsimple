"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button, Empty, ErrorBanner, Input, Segmented, Skeleton } from "@/components/ui";
import { ProjectCard, type ProjectListItem } from "@/components/project-card";
import { api } from "@/lib/api-client";

export default function ProjectsPage() {
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "open">("all");

  const load = () => api<{ projects: ProjectListItem[] }>("/api/projects").then((r) => setItems(r.projects)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const shown = (items ?? [])
    .filter((p) => p.title.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => (filter === "all" ? true : filter === "ready" ? p.status === "ready" : p.status !== "ready"));

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Every carousel you've made. Unfinished ones pick up where they stopped."
        actions={<Link href="/create"><Button variant="accent"><PenLine className="h-4 w-4" />New carousel</Button></Link>}
      />
      <ErrorBanner error={error} onRetry={() => { setError(null); load(); }} />
      {items === null && !error ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
      ) : items && items.length === 0 ? (
        <Empty title="No carousels yet" action={<Link href="/create"><Button className="mt-4" variant="accent">Create your first</Button></Link>}>
          Pick a topic and EditSimple researches it, writes the slides, designs them and drafts the caption.
        </Empty>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Input className="max-w-xs" placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} />
            <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "ready", label: "Ready" }, { value: "open", label: "Unfinished" }]} />
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((p) => <ProjectCard key={p.id} p={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
