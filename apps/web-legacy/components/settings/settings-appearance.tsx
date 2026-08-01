'use client';

import { useThemeStore } from '@/lib/stores/use-theme-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ACCENT_COLORS, FONTS, DENSITIES, THEME_MODES } from '@/lib/theme';

export function SettingsAppearance() {
  const { mode, accent, font, density, reducedMotion, setMode, setAccent, setFont, setDensity, setReducedMotion } = useThemeStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize how Project E looks and feels.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme mode */}
        <div className="space-y-2">
          <Label htmlFor="theme-mode">Theme</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as 'light' | 'dark' | 'system')}>
            <SelectTrigger id="theme-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Accent color */}
        <div className="space-y-2">
          <Label>Accent color</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent color">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setAccent(color.value)}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-all',
                  accent === color.value ? 'border-foreground scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
                aria-label={`${color.name} accent color`}
                role="radio"
                aria-checked={accent === color.value}
              />
            ))}
          </div>
        </div>

        {/* Font */}
        <div className="space-y-2">
          <Label htmlFor="settings-font">Font</Label>
          <Select value={font} onValueChange={setFont}>
            <SelectTrigger id="settings-font">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Density */}
        <div className="space-y-2">
          <Label htmlFor="settings-density">Density</Label>
          <Select value={density} onValueChange={(v) => setDensity(v as 'compact' | 'comfortable' | 'spacious')}>
            <SelectTrigger id="settings-density">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DENSITIES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reduced motion */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Reduced motion</Label>
            <p className="text-sm text-muted-foreground">Minimize animations and transitions</p>
          </div>
          <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} aria-label="Reduced motion" />
        </div>
      </CardContent>
    </Card>
  );
}
