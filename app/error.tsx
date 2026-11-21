"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground"
    >
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <AlertCircle
          aria-hidden="true"
          className="mx-auto size-9 text-destructive"
        />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The page could not be displayed. Try again, or return to the page
          later.
        </p>
        <Button type="button" onClick={retry} className="mt-6 w-full sm:w-auto">
          Try again
        </Button>
      </section>
    </main>
  );
}
