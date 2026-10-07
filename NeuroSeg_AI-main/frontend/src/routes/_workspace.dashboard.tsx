import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, CheckCircle2, Activity, XCircle, Cpu } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { activeModel, cases, metrics } from "@/lib/mock-data";

export const Route = createFileRoute("/_workspace/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NeuroSeg AI" },
      { name: "description", content: "Overview of cases, analyses, and the active segmentation model." },
      { property: "og:title", content: "Dashboard — NeuroSeg AI" },
      { property: "og:description", content: "Overview of cases, analyses, and the active segmentation model." },
    ],
  }),
  component: Dashboard,
});

const cards = [
  { label: "Total Cases", value: metrics.totalCases, icon: Layers, tone: "text-primary" },
  { label: "Completed Analyses", value: metrics.completed, icon: CheckCircle2, tone: "text-success" },
  { label: "Running Jobs", value: metrics.running, icon: Activity, tone: "text-info" },
  { label: "Failed Jobs", value: metrics.failed, icon: XCircle, tone: "text-destructive" },
];

function Dashboard() {
  return (
    <>
      <PageHeader title="Dashboard" crumbs={["Dashboard"]} />
      <div className="page-in space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="glass lift rounded-xl p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className={`h-5 w-5 ${c.tone}`} />
              </div>
              <p className="mt-3 font-display text-3xl font-semibold">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-6 shadow-glow">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-6">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand">
              <Cpu className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Active model
              </div>
              <h2 className="text-xl font-semibold">{activeModel.name} <span className="text-sm text-muted-foreground">{activeModel.version}</span></h2>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-sm">
              <div><dt className="text-muted-foreground">Architecture</dt><dd className="font-medium">{activeModel.architecture}</dd></div>
              <div><dt className="text-muted-foreground">Threshold</dt><dd className="font-mono font-medium">{activeModel.threshold.toFixed(2)}</dd></div>
              <div><dt className="text-muted-foreground">Parameters</dt><dd className="font-mono font-medium">{activeModel.params}</dd></div>
            </dl>
          </div>
        </div>

        <div className="glass overflow-hidden rounded-xl">
          <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Recent Activity</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-5 py-3">Case ID</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Model Used</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody>
                {cases.slice(0, 6).map((c) => (
                  <tr key={c.id} className="border-t border-border transition-colors hover:bg-accent/40">
                    <td className="px-5 py-3 font-mono"><Link to="/cases/$id" params={{ id: c.id }} className="text-primary hover:underline">{c.id}</Link></td>
                    <td className="px-5 py-3 text-muted-foreground">{c.date}</td>
                    <td className="px-5 py-3">{c.model}</td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
