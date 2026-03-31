import * as Sentry from '@sentry/nextjs';

export function reportError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'event',
    message: name,
    data: properties,
    level: 'info',
  });
}
