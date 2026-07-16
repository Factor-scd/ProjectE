// This file is loaded by Next.js at startup
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize webhook service
    const { initializeWebhookService } = await import('./lib/services/webhook-service');
    initializeWebhookService();

    console.log('[Project E] Webhook service initialized');
  }
}
