import { NextResponse } from "next/server";
import { getPrivilegedAuthState, getSafeRoleRedirect } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { current, managementActive } = await getPrivilegedAuthState();
    if (!current) return NextResponse.json({ user: null });
    const next = new URL(request.url).searchParams.get("next");
    const privileged = current.profile.role === "staff" || current.profile.role === "admin";
    return NextResponse.json({
      user: { id: current.user.id, phone: current.profile.phone },
      profile: current.profile,
      managementActive: privileged ? managementActive : null,
      managementRequired: privileged && !managementActive,
      redirectTo: current.profile.is_active && (!privileged || managementActive) ? getSafeRoleRedirect(current.profile.role, next) : null,
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
