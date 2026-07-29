'use client';

import { useKeyboardShortcutsStore } from '@/lib/stores/use-keyboard-shortcuts-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { NotificationPrefs } from '@/components/notifications/notification-prefs';

export function SettingsShortcuts() {
  const { enabled, shortcuts, setEnabled, resetShortcuts } = useKeyboardShortcutsStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyboard Shortcuts</CardTitle>
        <CardDescription>Customize keyboard shortcuts for quick navigation and actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/disable all */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable keyboard shortcuts</Label>
            <p className="text-sm text-muted-foreground">
              Turn off all keyboard shortcuts globally
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable keyboard shortcuts" />
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{shortcut.description}</p>
                <p className="text-xs text-muted-foreground">{shortcut.action}</p>
              </div>
              <kbd className="rounded border bg-muted px-2 py-1 text-sm font-mono">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Reset button */}
        <Button variant="outline" onClick={resetShortcuts}>
          Reset to defaults
        </Button>

        {/* Notification Preferences */}
        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-1">Notification Preferences</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which events trigger in-app notifications.
          </p>
          <NotificationPrefs />
        </div>
      </CardContent>
    </Card>
  );
}
