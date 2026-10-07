import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Hexagon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthCard({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isReg = mode === "register";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const pw = String(f.get("password") || "");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (isReg && pw !== f.get("confirm")) return setError("Passwords do not match.");
    setError("");
    setLoading(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 700);
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-cyan/20 blur-3xl" />
      <div className="glass page-in relative w-full max-w-md rounded-2xl p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand shadow-glow">
            <Hexagon className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold">{isReg ? "Create your workspace" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">NeuroSeg AI Research Platform</p>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" maxLength={255} placeholder="researcher@lab.org" className="h-11 bg-background/40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" maxLength={128} placeholder="••••••••" className="h-11 bg-background/40" />
          </div>
          {isReg && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" name="confirm" type="password" maxLength={128} placeholder="••••••••" className="h-11 bg-background/40" />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="lift h-11 w-full bg-brand font-semibold shadow-glow">
            {loading && <Loader2 className="animate-spin" />}
            {isReg ? "Register" : "Log In"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isReg ? "Already have an account? " : "New to NeuroSeg? "}
          <Link to={isReg ? "/" : "/register"} className="font-medium text-primary hover:underline">
            {isReg ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
