import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** Paddle checkout disabled — use SpaceRemit / local payment. */
export async function POST() {
  return NextResponse.json(
    { error: 'PADDLE_DISABLED', message: 'Paddle checkout has been removed. Use local payment (SpaceRemit) instead.' },
    { status: 410 },
  )
}
