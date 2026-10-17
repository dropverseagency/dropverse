import { NextResponse } from "next/server"

export const runtime = "nodejs"

/** Dodo Payments removed — SpaceRemit is the active payment path. */
export async function POST() {
  return NextResponse.json(
    { error: "DODO_DISABLED", message: "This payment provider is no longer available." },
    { status: 410 },
  )
}

export async function GET() {
  return NextResponse.json(
    { error: "DODO_DISABLED", message: "This payment provider is no longer available." },
    { status: 410 },
  )
}
