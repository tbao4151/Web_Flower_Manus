import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

export async function GET() {
  try {
    const current = await getCurrentProfile();
    if (!current) return NextResponse.json({ user: null });
    return NextResponse.json({ user: { id: current.user.id, phone: current.profile.phone }, profile: current.profile });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
