import { useAuthStore } from "./stores/use-auth-store";

/**
 * Boot-time session check. Runs once before the app renders so the shell never
 * flashes for unauthenticated users and the logged-in identity is available
 * immediately. Redirects to /login when unauthenticated and to / when an
 * authenticated user lands on /login.
 */
export async function bootstrapSession(): Promise<void> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    const data = await res.json().catch(() => ({ authenticated: false, user: null }));
    const user = data?.authenticated ? data.user : null;
    useAuthStore.setState({ user: user ?? null, checked: true });
    const path = window.location.pathname;
    if (user && path === "/login") {
      window.location.replace("/");
    } else if (!user && path !== "/login") {
      window.location.replace("/login");
    }
  } catch {
    useAuthStore.setState({ user: null, checked: true });
    if (window.location.pathname !== "/login") window.location.replace("/login");
  }
}
