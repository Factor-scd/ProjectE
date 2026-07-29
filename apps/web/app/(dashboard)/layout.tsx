import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/topbar';
import { NetworkErrorBanner } from '@/components/network-error-banner';
import { KeyboardShortcutsProvider } from '@/components/keyboard-shortcuts-provider';
import { WebVitalsTracker } from '@/components/web-vitals-tracker';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { DispatchPanel } from '@/components/agents/dispatch-panel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardShortcutsProvider>
      <WebVitalsTracker />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="flex min-h-screen">
        <NetworkErrorBanner />
        <Sidebar />
        <div className="flex flex-1 flex-col pb-16 md:pb-0">
          <TopBar />
          <main id="main-content" className="flex-1 overflow-auto p-6" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav />
      {/* Floating AI dispatch button */}
      <div className="fixed bottom-6 right-6 z-50">
        <DispatchPanel
          triggerLabel="Ask AI"
          triggerVariant="default"
          triggerClassName="h-12 w-12 rounded-full shadow-lg md:h-auto md:w-auto md:rounded-md md:px-4 md:py-2"
        />
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true" id="a11y-announcer" />
    </KeyboardShortcutsProvider>
  );
}
