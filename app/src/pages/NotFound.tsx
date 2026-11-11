import { Link } from "react-router";
import { EmptyState } from "@/components/ui";

export function NotFound() {
  return (
    <EmptyState title="This page doesn't exist">
      <Link to="/" className="text-accent hover:underline">
        Back to the overview
      </Link>
    </EmptyState>
  );
}
