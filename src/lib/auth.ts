import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

/** Signed-in user's profile, or redirect to login. */
export async function requireProfile(allowed?: Role[]) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single<Profile>();
  if (!profile) redirect("/login");
  if (allowed && profile.active && !allowed.includes(profile.role)) redirect("/");
  return { supabase, profile };
}
