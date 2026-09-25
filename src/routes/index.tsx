import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/comics/studio";

export const Route = createFileRoute("/")({ component: Studio });
