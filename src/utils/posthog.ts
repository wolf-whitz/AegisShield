import { PostHog } from 'posthog-node';

const posthogClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: 'https://us.i.posthog.com '
});

export function logError(event: string, properties: Record<string, any>): void {
  console.error(`[PostHog] Error event: ${event}`, properties);
  
  posthogClient.capture({
    distinctId: 'bot',
    event: `error_${event}`,
    properties: {
      ...properties,
      timestamp: new Date().toISOString()
    }
  });
}

export function shutdownPostHog(): Promise<void> {
  return posthogClient.shutdown();
}