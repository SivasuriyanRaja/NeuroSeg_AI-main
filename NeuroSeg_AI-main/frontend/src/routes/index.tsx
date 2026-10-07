import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Log In — NeuroSeg AI Workspace" },
      { name: "description", content: "Sign in to NeuroSeg AI, the research workspace for brain MRI tumor segmentation." },
      { property: "og:title", content: "Log In — NeuroSeg AI Workspace" },
      { property: "og:description", content: "Research workspace for brain MRI tumor segmentation and classification." },
    ],
  }),
  component: () => <AuthCard mode="login" />,
});
