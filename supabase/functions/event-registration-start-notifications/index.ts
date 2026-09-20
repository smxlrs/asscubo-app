import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getSupabaseAdminKey, isInternalSupabaseRequest } from "../_shared/supabase-keys.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabase = createClient(supabaseUrl, getSupabaseAdminKey());

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!isInternalSupabaseRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let eventId: string | null = null;
  try {
    const body = await req.json();
    eventId = typeof body?.event_id === "string" ? body.event_id : null;
  } catch {
    // An empty body is allowed for backwards-compatible manual invocations.
  }

  const now = new Date().toISOString();
  let eventQuery = supabase
    .from("events")
    .select("id, title")
    .eq("is_published", true)
    .eq("registration_status", "open")
    .eq("registration_start_notify_enabled", true)
    .not("registration_start_at", "is", null)
    .lte("registration_start_at", now);
  if (eventId) eventQuery = eventQuery.eq("id", eventId);
  const { data: events, error: eventError } = await eventQuery;
  if (eventError) return Response.json({ error: eventError.message }, { status: 500 });

  const { data: tokenRows, error: tokenError } = await supabase.from("push_tokens").select("token");
  if (tokenError) return Response.json({ error: tokenError.message }, { status: 500 });
  const tokens = [...new Set((tokenRows || []).map((row: any) => row.token).filter(Boolean))];
  let sent = 0;

  for (const event of events || []) {
    const { data: claimed, error: claimError } = await supabase
      .from("events")
      .update({ registration_start_notify_enabled: false })
      .eq("id", event.id)
      .eq("registration_start_notify_enabled", true)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) continue;

    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title: `【活动通知】${event.title}`,
      body: `${event.title}已开始报名！`,
      data: { category: "events", eventId: event.id },
    }));
    if (messages.length === 0) continue;
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    if (response.ok) sent += messages.length;
  }

  return Response.json({ processed: events?.length || 0, sent });
});
