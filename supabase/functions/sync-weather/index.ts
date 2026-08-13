// Scheduled ingest: refresh the single 'weather' entry from Open-Meteo (no key).
// Canonical logic mirrors src/modules/weather/index.tsx.
import { upsertEntries, json, recordSyncHealth, type EntryUpsert } from "../_shared/upsert.ts";

function weatherText(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Mainly clear";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Thunderstorm";
  return "—";
}

Deno.serve(async () => {
  try {
    const lat = Deno.env.get("WEATHER_LAT") ?? "37.77";
    const lon = Deno.env.get("WEATHER_LON") ?? "-122.42";
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;

    const res = await fetch(url);
    if (!res.ok) {
      await recordSyncHealth("open_meteo", { ok: false, error: `open-meteo ${res.status}` });
      return json({ ok: false, error: `open-meteo ${res.status}` }, 502);
    }
    const data = await res.json();

    const row: EntryUpsert = {
      type: "weather",
      source: "open_meteo",
      external_id: "current",
      status: "active",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      payload: {
        tempF: Math.round(data.current.temperature_2m),
        code: data.current.weather_code,
        summary: weatherText(data.current.weather_code),
        hiF: Math.round(data.daily.temperature_2m_max[0]),
        loF: Math.round(data.daily.temperature_2m_min[0]),
      },
    };
    await upsertEntries([row]);
    await recordSyncHealth("open_meteo", { ok: true });
    return json({ ok: true });
  } catch (e) {
    console.error("[weather] failed", e);
    await recordSyncHealth("open_meteo", { ok: false, error: String(e) });
    return json({ ok: false, error: String(e) }, 500);
  }
});
