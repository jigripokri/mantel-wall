import type { FeatureModule, IngestContext, EntryUpsert, Entry } from "../../lib/types";

/** Open-Meteo — no API key. Lat/lon from env, defaulting to a placeholder. */
async function ingest(ctx: IngestContext): Promise<EntryUpsert[]> {
  const lat = ctx.env.WEATHER_LAT ?? "37.77";
  const lon = ctx.env.WEATHER_LON ?? "-122.42";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;

  const res = await ctx.fetch(url);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const data = (await res.json()) as {
    current: { temperature_2m: number; weather_code: number };
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  };

  const expires = new Date(ctx.now.getTime() + 60 * 60 * 1000).toISOString();
  return [
    {
      type: "weather",
      source: "open_meteo",
      external_id: "current", // single row, always upserted in place
      status: "active",
      expires_at: expires,
      payload: {
        tempF: Math.round(data.current.temperature_2m),
        code: data.current.weather_code,
        summary: weatherText(data.current.weather_code),
        hiF: Math.round(data.daily.temperature_2m_max[0]),
        loF: Math.round(data.daily.temperature_2m_min[0]),
      },
    },
  ];
}

function WeatherTile({ entry }: { entry: Entry }) {
  const p = entry.payload as { tempF?: number; summary?: string; hiF?: number; loF?: number };
  return (
    <div className="text-right">
      <div className="font-display text-6xl leading-none text-[var(--color-ink)]">
        {p.tempF ?? "--"}°
      </div>
      <div className="mt-1 text-lg text-[var(--color-ink-dim)]">{p.summary ?? ""}</div>
      {p.hiF != null && (
        <div className="text-base text-[var(--color-ink-dim)]">
          H {p.hiF}° · L {p.loF}°
        </div>
      )}
    </div>
  );
}

export function weatherText(code: number): string {
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

export const weatherModule: FeatureModule = {
  type: "weather",
  label: "Weather",
  layer: "overlay",
  ingest,
  TvTile: WeatherTile,
  showOnTv: (e) => e.type === "weather",
};
