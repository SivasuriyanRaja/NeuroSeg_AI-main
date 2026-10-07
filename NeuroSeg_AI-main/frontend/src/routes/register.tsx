import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth-card";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register — NeuroSeg AI Workspace" },
      { name: "description", content: "Create a NeuroSeg AI research account." },
      { property: "og:title", content: "Register — NeuroSeg AI Workspace" },
      { property: "og:description", content: "Create a NeuroSeg AI research account." },
    ],
  }),
  component: () => <AuthCard mode="register" />,
});
