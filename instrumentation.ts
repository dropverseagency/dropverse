import type { Instrumentation } from 'next'
import { reportOpsError } from './lib/opsAlerts'
import { createServiceClient } from './lib/supabaseService'

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const headerValue = (name: string) => {
    const value = request.headers?.[name]
    return Array.isArray(value) ? value[0] : value
  }

  try {
    await reportOpsError(createServiceClient(), error, {
      source: 'next-runtime',
      path: request.path,
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      requestId: headerValue('x-vercel-id') || headerValue('x-request-id'),
    })
  } catch (reportError) {
    console.error(
      '[instrumentation] error reporting failed',
      reportError instanceof Error ? reportError.message : 'unknown',
    )
  }
}
