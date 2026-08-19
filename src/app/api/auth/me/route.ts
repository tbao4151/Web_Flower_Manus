import { NextResponse } from "next/server";
import { getPrivilegedAuthState, getSafeRoleRedirect, isProfileComplete } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { current, managementActive } = await getPrivilegedAuthState();
    if (!current) return NextResponse.json({ user: null });
    const next = new URL(request.url).searchParams.get("next");
    const privileged = current.profile.role === "staff" || current.profile.role === "admin";
    const complete = isProfileComplete(current.profile);
    return NextResponse.json({
      user: { id: current.user.id, email: current.user.email || null },
      profile: current.profile,
      isProfileComplete: complete,
      managementActive: privileged ? managementActive : null,
      managementRequired: privileged && complete && !managementActive,
      redirectTo: !complete ? "/hoan-tat-ho-so" : current.profile.is_active && (!privileged || managementActive) ? getSafeRoleRedirect(current.profile.role, next) : null,
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
