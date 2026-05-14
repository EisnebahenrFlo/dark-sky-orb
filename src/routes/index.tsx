import { createFileRoute } from "@tanstack/react-router";
import { CurrentPage } from "@/pages/Current";

export const Route = createFileRoute("/")({ component: CurrentPage });
