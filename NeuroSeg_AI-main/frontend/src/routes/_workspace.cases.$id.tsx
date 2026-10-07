import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileDown, FileJson, ImageDown, ZoomIn, ZoomOut, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StatusBadge } from "@/components/status-badge";
import { cases } from "@/lib/mock-data";
import mri from "@/assets/mri.jpg";

export const Route = createFileRoute("/_workspace/cases/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Case ${params.id} — NeuroSeg AI` },
      { name: "description", content: "Inspect segmentation results, metrics, and notes for an MRI case." },
      { property: "og:title", content: `Case ${params.id} — NeuroSeg AI` },
      { property: "og:description", content: "Inspect segmentation results, metrics, and notes for an MRI case." },
    ],
  }),
  component: CaseDetail,
});

const modes = ["Original", "Overlay", "Mask", "Prob Map"] as const;

function CaseDetail() {
  const { id } = Route.useParams();
  const c = cases.find((x) => x.id === id) ?? cases[0]!;
  const [mode, setMode] = useState<(typeof modes)[number]>("Overlay");
  const [opacity, setOpacity] = useState(0.6);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [notes, setNotes] = useState("Enhancing lesion in right temporal lobe with surrounding edema.");
  const [saved, setSaved] = useState(true);
  const [imageSrc, setImageSrc] = useState(mri);

  useEffect(() => {
    const uploaded = sessionStorage.getItem("uploadedImage");
    if (uploaded) {
      setImageSrc(uploaded);
    }
  }, []);

  useEffect(() => {
    if (saved) return;
    const t = setTimeout(() => setSaved(true), 900);
    return () => clearTimeout(t);
  }, [notes, saved]);

  const showMask = mode !== "Original";
  const lesion =
    mode === "Prob Map"
      ? "radial-gradient(circle at 38% 52%, oklch(0.85 0.18 85) 0%, oklch(0.66 0.21 22) 6%, oklch(0.7 0.15 245 / 0.6) 12%, transparent 18%)"
      : "radial-gradient(ellipse 9% 7% at 38% 52%, var(--primary) 0 80%, transparent 100%)";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-muted-foreground" />
          <Button variant="ghost" size="icon" asChild><Link to="/cases" aria-label="Back"><ArrowLeft /></Link></Button>
          <div>
            <p className="text-xs text-muted-foreground">Workspace / Cases / {c.id}</p>
            <h1 className="flex items-center gap-3 text-xl font-semibold">{c.label} <StatusBadge status={c.status} /></h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><FileDown /> PDF</Button>
          <Button variant="outline" size="sm"><FileJson /> JSON</Button>
          <Button variant="outline" size="sm"><ImageDown /> PNG</Button>
        </div>
      </header>

      <div className="page-in flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
        <section className="glass flex min-h-[420px] flex-col rounded-xl lg:w-[70%]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
            <div className="flex gap-1 rounded-lg bg-background/50 p-1">
              {modes.map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut /></Button>
              <span className="w-12 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn /></Button>
              <Button variant="ghost" size="icon" aria-label="Reset view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><RotateCcw /></Button>
            </div>
          </div>
          <div
            className="relative flex-1 cursor-grab touch-none overflow-hidden bg-background active:cursor-grabbing"
            onWheel={(e) => setZoom((z) => Math.min(4, Math.max(0.5, z - e.deltaY * 0.001)))}
            onPointerDown={(e) => { drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; }}
            onPointerMove={(e) => drag.current && setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })}
            onPointerUp={() => (drag.current = null)}
            onPointerLeave={() => (drag.current = null)}
          >
            <div className="absolute inset-0 grid place-items-center">
              <div className="relative aspect-square h-full max-h-full select-none" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                <img src={imageSrc} alt="MRI scan" draggable={false} width={816} height={816}
                  className="h-full w-full object-contain" style={{ opacity: mode === "Mask" ? 0.08 : 1 }} />
                {showMask && (
                  <div className="pointer-events-none absolute inset-0 mix-blend-screen"
                    style={{ background: lesion, opacity: mode === "Mask" ? 1 : opacity }} />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 border-t border-border p-4">
            <span className="text-sm text-muted-foreground">Overlay opacity</span>
            <Slider className="max-w-xs" min={0} max={1} step={0.01} value={[opacity]} onValueChange={(v) => setOpacity(v[0] ?? 0.6)} />
            <span className="font-mono text-xs text-primary">{Math.round(opacity * 100)}%</span>
          </div>
        </section>

        <aside className="glass space-y-6 overflow-y-auto rounded-xl p-5 lg:w-[30%]">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Analysis run</label>
            <Select defaultValue="r3">
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="r3">Run #3 · DenseNet121 · τ 0.50</SelectItem>
                <SelectItem value="r2">Run #2 · UNet++ · τ 0.45</SelectItem>
                <SelectItem value="r1">Run #1 · DenseNet121 · τ 0.60</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Metrics</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[["Foreground Pixels", "4,812"], ["Tumor Fraction", "2.31%"], ["Dice Score", "0.94"], ["Volume (est.)", "18.4 cm³"]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-background/40 p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-mono font-semibold">{v}</dd></div>
              ))}
              <div className="col-span-2 rounded-lg bg-background/40 p-3"><dt className="text-xs text-muted-foreground">Bounding Box (x, y, w, h)</dt><dd className="font-mono font-semibold">[284, 372, 96, 78]</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Classification</h3>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold">{c.cls === "—" ? "Glioma" : c.cls}</span>
                <span className="font-mono text-primary">{Math.round((c.conf || 0.94) * 100)}%</span>
              </div>
              <Progress value={(c.conf || 0.94) * 100} className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">Predicted class confidence</p>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Notes</h3>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {saved ? <><Check className="h-3 w-3 text-success" /> Saved</> : <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
              </span>
            </div>
            <Textarea rows={5} maxLength={2000} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} placeholder="Write findings…" />
          </div>
        </aside>
      </div>
    </div>
  );
}
