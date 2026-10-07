import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cases as initial } from "@/lib/mock-data";
import mri from "@/assets/mri.jpg";

export const Route = createFileRoute("/_workspace/cases/")({
  head: () => ({
    meta: [
      { title: "Cases — NeuroSeg AI" },
      { name: "description", content: "Browse and manage MRI analysis cases." },
      { property: "og:title", content: "Cases — NeuroSeg AI" },
      { property: "og:description", content: "Browse and manage MRI analysis cases." },
    ],
  }),
  component: Cases,
});

function Cases() {
  const [q, setQ] = useState("");
  const [list, setList] = useState(initial);
  const shown = list.filter((c) => (c.label + c.id).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Cases" crumbs={["Cases"]} actions={
        <Button asChild className="lift bg-brand font-semibold"><Link to="/analyze"><Plus /> New Case</Link></Button>
      } />
      <div className="page-in space-y-6 p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases…" className="h-10 pl-9" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((c, i) => (
            <div key={c.id} className="glass lift group relative overflow-hidden rounded-xl">
              <Link to="/cases/$id" params={{ id: c.id }} className="block">
                <div className="aspect-square overflow-hidden bg-background">
                  <img src={mri} alt={c.label} loading="lazy" width={816} height={816}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ filter: `hue-rotate(${i * 12}deg) brightness(${0.85 + (i % 3) * 0.08})` }} />
                </div>
                <div className="space-y-2 p-4">
                  <p className="truncate font-medium">{c.label}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{c.date}</span>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              </Link>
              <button aria-label={`Delete ${c.label}`} onClick={() => setList((l) => l.filter((x) => x.id !== c.id))}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-background/70 text-destructive opacity-0 backdrop-blur transition-opacity hover:bg-destructive/20 focus-visible:opacity-100 group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {shown.length === 0 && <p className="py-16 text-center text-muted-foreground">No cases match your search.</p>}
      </div>
    </>
  );
}
