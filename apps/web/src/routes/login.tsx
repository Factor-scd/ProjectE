import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/use-auth-store";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || data.message || "Login failed");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.user) useAuthStore.getState().setUser(data.user);
      navigate({ to: "/" });
    } catch {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left branding side - hidden on mobile */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 lg:flex">
        {/* Decorative dots */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-1/4 h-2 w-2 rounded-full bg-rose-500/40" />
          <div className="absolute right-1/3 top-1/3 h-3 w-3 rounded-full bg-amber-500/30" />
          <div className="absolute bottom-1/4 left-1/3 h-2.5 w-2.5 rounded-full bg-violet-500/35" />
          <div className="absolute bottom-1/3 right-1/4 h-2 w-2 rounded-full bg-emerald-500/30" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-sky-500/25" />
        </div>

        {/* Branding content */}
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "hsl(var(--accent-hsl))" }}
          >
            <span className="text-2xl font-bold text-white">E</span>
          </span>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Project E</h1>
            <p className="text-muted-foreground">Your productivity command center</p>
          </div>
        </div>
      </div>

      {/* Right form side */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-8 sm:px-6 lg:w-1/2">
        {/* Mobile branding - shown only on mobile */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "hsl(var(--accent-hsl))" }}
          >
            <span className="text-2xl font-bold text-white">E</span>
          </span>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-2xl font-bold tracking-tight">Project E</h1>
            <p className="text-sm text-muted-foreground">Your productivity command center</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <Card className="border shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Welcome back</CardTitle>
              <p className="text-sm text-muted-foreground">Sign in to continue</p>
            </CardHeader>
            <CardContent>
              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    required
                    className={error ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className={error ? "border-destructive" : ""}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[hsl(var(--accent-hsl))] text-white hover:bg-[hsl(var(--accent-hsl))]/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});
