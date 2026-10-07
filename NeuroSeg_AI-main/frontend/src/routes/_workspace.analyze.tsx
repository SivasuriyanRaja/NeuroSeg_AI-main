import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Brain, Sparkles, FileImage, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_workspace/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze MRI — NeuroSeg AI" },
      { name: "description", content: "Upload a brain MRI scan and run AI tumor segmentation." },
      { property: "og:title", content: "Analyze MRI — NeuroSeg AI" },
      { property: "og:description", content: "Upload a brain MRI scan and run AI tumor segmentation." },
    ],
  }),
  component: Analyze,
});

function Analyze() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [threshold, setThreshold] = useState(0.5);
  const [progress, setProgress] = useState<number | null>(null);

  function run() {
    setProgress(0);
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          sessionStorage.setItem("uploadedImage", e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
    
    const t = setInterval(() => {
      setProgress((p) => {
        const n = (p ?? 0) + 4;
        if (n >= 100) { clearInterval(t); setTimeout(() => navigate({ to: "/cases/$id", params: { id: "C-1042" } }), 300); }
        return Math.min(n, 100);
      });
    }, 80);
  }

  return (
    <>
      <PageHeader title="Analyze" crumbs={["Analyze"]} />
      <div className="page-in grid gap-6 p-6 lg:grid-cols-[1fr_340px]">
        <div
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0] ?? null); }}
          className={`relative grid min-h-[460px] cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all ${drag ? "border-primary bg-primary/10 shadow-glow" : "border-primary/40 bg-card hover:border-primary hover:shadow-glow"}`}
        >
          <input ref={input} type="file" accept="image/*,.nii,.dcm" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {progress !== null && <div className="scanline absolute inset-x-0 h-0.5 bg-primary shadow-glow" />}
          {file ? (
            <div className="flex flex-col items-center gap-3">
              <FileImage className="h-14 w-14 text-primary" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              {progress === null && (
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}><X /> Remove</Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 shadow-glow">
                <Brain className="h-10 w-10 text-primary" />
              </div>
              <p className="text-xl font-semibold">Drag & Drop MRI Scan here or click to browse</p>
              <p className="text-sm text-muted-foreground">JPG, PNG, DICOM or NIfTI · up to 50 MB</p>
            </div>
          )}
        </div>

        <div className="glass space-y-6 rounded-2xl p-6">
          <h2 className="font-semibold">Run configuration</h2>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Model version</label>
            <Select defaultValue="densenet">
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="densenet">DenseNet121 v2.4.1</SelectItem>
                <SelectItem value="unetpp">UNet++ v1.9.0</SelectItem>
                <SelectItem value="swin">SwinUNETR v0.7.2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Segmentation Threshold</span><span className="font-mono text-primary">{threshold.toFixed(2)}</span></div>
            <Slider min={0} max={1} step={0.01} value={[threshold]} onValueChange={(v) => setThreshold(v[0] ?? 0.5)} />
          </div>
          {progress !== null && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground"><span className="animate-pulse">Segmenting…</span><span>{progress}%</span></div>
              <Progress value={progress} />
            </div>
          )}
          <Button onClick={run} disabled={!file || progress !== null} className="lift h-12 w-full bg-brand text-base font-semibold shadow-glow">
            <Sparkles /> Run AI Analysis
          </Button>
        </div>
      </div>
    </>
  );
}
