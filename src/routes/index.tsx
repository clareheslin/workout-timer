import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "MOVE TIMER" },
      { name: "description", content: "Mobile-first workout interval timer." },
    ],
  }),
});

function Index() {
  return <AppShell />;
}
