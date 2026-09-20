import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  let supabase: "ok" | "off" | "error" = "off";
  if (sb) {
    const { error } = await sb.from("lessons").select("id", { count: "exact", head: true });
    supabase = error ? "error" : "ok";
  }
  return Response.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase,
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  });
}
