import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { experiments } from "@/lib/mock-data";

export const Route = createFileRoute("/_workspace/experiments")({
  head: () => ({
    meta: [
      { title: "Experiments — NeuroSeg AI" },
      { name: "description", content: "Track training runs, Dice and IoU scores, memory, and latency." },
      { property: "og:title", content: "Experiments — NeuroSeg AI" },
      { property: "og:description", content: "Track training runs, Dice and IoU scores, memory, and latency." },
    ],
  }),
  component: Experiments,
});

const score = (v: number) => (v >= 0.9 ? "text-success" : v >= 0.85 ? "text-warning" : "text-destructive");

function Experiments() {
  return (
    <>
      <PageHeader title="Experiments" crumbs={["Experiments"]} />
      <div className="page-in space-y-6 p-6">
        <div className="glass rounded-xl p-5">
          <h2 className="mb-4 font-semibold">Best Val Dice by run</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={experiments}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="arch" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0.7, 1]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="dice" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Run Name", "Model Architecture", "Dataset", "Epochs", "Best Val Dice", "Test IoU", "Peak Memory (MB)", "Latency (ms)"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {experiments.map((e) => (
                <tr key={e.run} className="border-t border-border transition-colors hover:bg-accent/40">
                  <td className="whitespace-nowrap px-4 py-3 text-primary">{e.run}</td>
                  <td className="px-4 py-3 font-sans">{e.arch}</td>
                  <td className="px-4 py-3 font-sans text-muted-foreground">{e.dataset}</td>
                  <td className="px-4 py-3">{e.epochs}</td>
                  <td className={`px-4 py-3 font-semibold ${score(e.dice)}`}>{e.dice.toFixed(3)}</td>
                  <td className={`px-4 py-3 ${score(e.iou)}`}>{e.iou.toFixed(3)}</td>
                  <td className="px-4 py-3">{e.mem.toLocaleString()}</td>
                  <td className="px-4 py-3">{e.lat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
