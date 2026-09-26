import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getSupabaseAdminKey, isInternalSupabaseRequest } from "../_shared/supabase-keys.ts";
import { sendEventPushBatch } from "../_shared/event-push-delivery.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabase = createClient(supabaseUrl, getSupabaseAdminKey());

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!isInternalSupabaseRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let jobId: string;
  try {
    const body = await req.json();
    if (typeof body?.job_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.job_id)) {
      return Response.json({ error: "A valid notification job_id is required." }, { status: 400 });
    }
    jobId = body.job_id;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { data: job, error: claimError } = await supabase.rpc("claim_event_registration_notification", { p_job_id: jobId });
  if (claimError) return Response.json({ error: "Could not claim notification job." }, { status: 503 });
  if (!job?.claimed) return Response.json({ processed: false, status: job?.status || "not_claimed" });

  const started = Date.now();
  let failure: string | null = null;
  try {
    const tokens = job.tokens as string[];
    for (let offset = 0; offset < tokens.length; offset += 100) {
      if (Date.now() - started > 100000) { failure = "Remaining recipients will continue in the next attempt."; break; }
      // Check ownership between batches so disabling/rescheduling can stop this worker.
      const { data: active, error: activeError } = await supabase.rpc("record_event_registration_notification_batch", {
        p_job_id: jobId, p_lease_token: job.lease_token, p_results: [],
      });
      if (activeError) throw new Error("Could not verify notification job ownership.");
      if (!active) return Response.json({ processed: false, status: "cancelled_or_replaced" });
      const outcomes = await sendEventPushBatch(tokens.slice(offset, offset + 100), job.title, job.event_id);
      const { data: saved, error: saveError } = await supabase.rpc("record_event_registration_notification_batch", {
        p_job_id: jobId, p_lease_token: job.lease_token, p_results: outcomes,
      });
      if (saveError) throw new Error("Could not record Expo push outcomes.");
      if (!saved) return Response.json({ processed: false, status: "cancelled_or_replaced" });
      if (outcomes.some((outcome) => outcome.status !== 'sent')) failure = "Some devices did not accept the notification.";
      if (offset + 100 < tokens.length) await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : "Notification delivery interrupted.";
  }
  const { data: result, error: finishError } = await supabase.rpc("finish_event_registration_notification", {
    p_job_id: jobId, p_lease_token: job.lease_token, p_error: failure,
  });
  if (finishError) return Response.json({ error: "Could not finish notification attempt; watchdog will recover it." }, { status: 503 });
  return Response.json(result, { status: result?.status === 'pending' ? 202 : result?.status === 'failed' ? 502 : 200 });
});
