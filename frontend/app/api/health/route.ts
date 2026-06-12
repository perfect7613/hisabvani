import { NextResponse } from 'next/server';

const BACKEND_URL = (
  process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'
).replace(/\/$/, '');

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(
        {
          status: 'healthy',
          backend: 'connected',
          ...data,
        },
        {
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    return NextResponse.json(
      { status: 'degraded', backend: 'unavailable', code: response.status },
      { status: 503 }
    );
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'degraded', 
        backend: 'timeout', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 503 }
    );
  }
}
