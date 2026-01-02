import React from "react";
import { Button } from "./ui/button.tsx";

type Props = {
  children: React.ReactNode;
  title?: string;
  description?: string;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Helps debug "blank page" crashes in production.
    console.error("Route crashed:", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background">
        <section className="container mx-auto max-w-2xl px-4 py-10">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {this.props.title ?? "This page crashed"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {this.props.description ??
                "Something went wrong while loading this screen. Please try again."}
            </p>
          </header>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={this.handleReload}>Reload</Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              Go back
            </Button>
          </div>
        </section>
      </main>
    );
  }
}