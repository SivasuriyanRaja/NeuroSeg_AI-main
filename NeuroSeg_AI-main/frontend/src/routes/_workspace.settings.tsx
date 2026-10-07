import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PieChart, Pie, Cell } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_workspace/settings")({
  head: () => ({
    meta: [
      { title: "Settings — NeuroSeg AI" },
      { name: "description", content: "Storage usage and analysis preferences." },
      { property: "og:title", content: "Settings — NeuroSeg AI" },
      { property: "og:description", content: "Storage usage and analysis preferences." },
    ],
  }),
  component: SettingsPage,
});

const storage = [
  { name: "Uploads", used: 12.4, total: 50, color: "var(--primary)" },
  { name: "Results", used: 28.9, total: 50, color: "var(--cyan)" },
  { name: "Models", used: 41.2, total: 50, color: "var(--warning)" },
];

function SettingsPage() {
  const [auto, setAuto] = useState(true);
  const [hires, setHires] = useState(false);
  return (
    <>
      <PageHeader title="Settings" crumbs={["Settings"]} />
      <div className="page-in space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {storage.map((s) => {
            const pct = Math.round((s.used / s.total) * 100);
            return (
              <div key={s.name} className="glass flex items-center gap-5 rounded-xl p-5">
                <div className="relative h-24 w-24">
                  <PieChart width={96} height={96}>
                    <Pie data={[{ v: s.used }, { v: s.total - s.used }]} dataKey="v" innerRadius={34} outerRadius={44} startAngle={90} endAngle={-270} stroke="none">
                      <Cell fill={s.color} />
                      <Cell fill="var(--muted)" />
                    </Pie>
                  </PieChart>
                  <span className="absolute inset-0 grid place-items-center font-mono text-sm font-semibold">{pct}%</span>
                </div>
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.used} GB of {s.total} GB</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="glass max-w-2xl divide-y divide-border rounded-xl">
          {[
            { label: "Auto-run analysis on upload", desc: "Start segmentation as soon as a scan is uploaded.", v: auto, set: setAuto },
            { label: "High-resolution output", desc: "Export masks and probability maps at full resolution.", v: hires, set: setHires },
          ].map((p) => (
            <label key={p.label} className="flex cursor-pointer items-center justify-between gap-4 p-5">
              <div><p className="font-medium">{p.label}</p><p className="text-sm text-muted-foreground">{p.desc}</p></div>
              <Switch checked={p.v} onCheckedChange={p.set} />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
