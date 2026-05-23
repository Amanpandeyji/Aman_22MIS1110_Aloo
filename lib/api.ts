export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function withJsonError<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): Promise<Response> {
  try {
    return await handler();
  } catch (err: any) {
    // Log on the server for diagnostics
    // eslint-disable-next-line no-console
    console.error('Unhandled API error', err?.stack || err?.message || err);
    return jsonResponse({ message: 'Internal server error' }, 500);
  }
}

export function jsonError(message: string, status = 400) {
  return jsonResponse({ message }, status);
}
