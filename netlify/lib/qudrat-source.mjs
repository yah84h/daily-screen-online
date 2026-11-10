import { clients } from "./staff.mjs";
// The leaderboard link holds a key, so it lives in a table only the service role can read.
const KEY = "qudrat_pro_url",
  TTL = 60000;
let memory = null;
/** Link saved from the admin panel, or '' when none is saved or the store is unavailable. */
export async function savedSource() {
  if (memory && Date.now() - memory.at < TTL) return memory.url;
  try {
    const { admin } = clients();
    const { data, error } = await admin
      .from("server_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    if (error) throw error;
    const url = typeof data?.value === "string" ? data.value : "";
    // Cache only a found link. Each function keeps its own memory, so caching "none" here would
    // hide a link saved moments ago by the qudrat-source function for up to a minute.
    memory = url ? { url, at: Date.now() } : null;
    return url;
  } catch {
    return memory?.url || "";
  }
}
export async function storeSource(admin, url) {
  const result = url
    ? await admin
        .from("server_settings")
        .upsert({ key: KEY, value: url, updated_at: new Date().toISOString() })
    : await admin.from("server_settings").delete().eq("key", KEY);
  if (result.error)
    throw Error(
      /server_settings/.test(result.error.message || "") ||
        result.error.code === "42P01" ||
        result.error.code === "PGRST205"
        ? "طبّق ترحيل Supabase رقم 0010_qudrat_source.sql أولًا ثم أعد المحاولة."
        : "تعذر حفظ الرابط: " + result.error.message,
    );
  memory = { url: url || "", at: Date.now() };
}
