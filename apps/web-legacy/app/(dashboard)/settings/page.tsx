'use client';

import {
  Palette,
  Globe,
  Keyboard,
  Bot,
  Webhook,
  Download,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsAppearance } from '@/components/settings/settings-appearance';
import { SettingsDomains } from '@/components/settings/settings-domains';
import { SettingsShortcuts } from '@/components/settings/settings-shortcuts';
import { SettingsAgents } from '@/components/settings/settings-agents';
import { SettingsWebhooks } from '@/components/settings/settings-webhooks';
import { SettingsImportExport } from '@/components/settings/settings-import-export';
import { SettingsTags } from '@/components/settings/settings-tags';
import { SettingsCustomFields } from '@/components/settings/settings-custom-fields';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">Tune Project E to fit your work.</p>
      </div>

      <Tabs defaultValue="appearance" orientation="vertical" className="flex flex-col gap-6 md:flex-row">
        <TabsList className="flex h-auto w-full flex-row justify-start gap-1 overflow-x-auto bg-transparent p-0 md:w-[200px] md:flex-col">
          <TabsTrigger value="appearance" className="shrink-0 justify-start gap-2">
            <Palette className="h-4 w-4" aria-hidden="true" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="domains" className="shrink-0 justify-start gap-2">
            <Globe className="h-4 w-4" aria-hidden="true" />
            Domains
          </TabsTrigger>
          <TabsTrigger value="tags" className="shrink-0 justify-start gap-2">
            <Tag className="h-4 w-4" aria-hidden="true" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="custom-fields" className="shrink-0 justify-start gap-2">
            <Tag className="h-4 w-4" aria-hidden="true" />
            Custom Fields
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className="shrink-0 justify-start gap-2">
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            Keyboard Shortcuts
          </TabsTrigger>
          <TabsTrigger value="agents" className="shrink-0 justify-start gap-2">
            <Bot className="h-4 w-4" aria-hidden="true" />
            Agents & Permissions
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="shrink-0 justify-start gap-2">
            <Webhook className="h-4 w-4" aria-hidden="true" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="import-export" className="shrink-0 justify-start gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            Import & Export
          </TabsTrigger>
          <TabsTrigger value="error-log" className="shrink-0 justify-start gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Error Log
          </TabsTrigger>
        </TabsList>

        <div className="min-w-0 flex-1">
          <TabsContent value="appearance">
            <SettingsAppearance />
          </TabsContent>
          <TabsContent value="domains">
            <SettingsDomains />
          </TabsContent>
          <TabsContent value="tags">
            <SettingsTags />
          </TabsContent>
          <TabsContent value="custom-fields">
            <SettingsCustomFields />
          </TabsContent>
          <TabsContent value="shortcuts">
            <SettingsShortcuts />
          </TabsContent>
          <TabsContent value="agents">
            <SettingsAgents />
          </TabsContent>
          <TabsContent value="webhooks">
            <SettingsWebhooks />
          </TabsContent>
          <TabsContent value="import-export">
            <SettingsImportExport />
          </TabsContent>
          <TabsContent value="error-log">
            <Card>
              <CardHeader>
                <CardTitle>Error Log</CardTitle>
                <CardDescription>View recent application errors</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  See the{' '}
                  <a href="/settings/error-log" className="text-primary underline">
                    detailed error log
                  </a>{' '}
                  for more information.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
