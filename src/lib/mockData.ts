import type { Entry } from "./types";

/** The 5B person palette. Matched lightness so no one person shouts on the wall.
 *  Real feeds get their colour from the sync config; these are for demo mode. */
const PERSON = {
  clay: "hsl(16 45% 68%)",
  ochre: "hsl(42 48% 62%)",
  sage: "hsl(115 18% 60%)",
  harbor: "hsl(210 28% 68%)",
  heather: "hsl(310 16% 68%)",
} as const;

/** Deterministic sample rows so /tv and / render without a database.
 *  Times are computed relative to `now` at read time so the agenda always looks live. */
export function mockEntries(now: Date): Entry[] {
  const iso = (d: Date) => d.toISOString();
  const at = (hours: number, minutes = 0, dayOffset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hours, minutes, 0, 0);
    return iso(d);
  };
  const base = {
    created_at: iso(now),
    updated_at: iso(now),
    due_at: null,
    expires_at: null,
    status: "active" as const,
    external_id: null,
    pinned: false,
    sort_order: 0,
    media_key: null,
    created_by: null,
  };

  return [
    {
      ...base,
      id: "evt-1",
      type: "event",
      source: "google_cal",
      starts_at: at(8, 30),
      ends_at: at(9, 0),
      color: PERSON.ochre,
      payload: { title: "School drop-off", location: "Oakwood Elementary", person: "Maya" },
    },
    {
      ...base,
      id: "evt-2",
      type: "event",
      source: "icloud",
      starts_at: at(12, 0),
      ends_at: at(13, 0),
      color: PERSON.clay,
      payload: { title: "Lunch with Priya", location: "Cafe Rio", person: "Mom" },
    },
    {
      ...base,
      id: "evt-3",
      type: "event",
      source: "school",
      starts_at: at(16, 0),
      ends_at: at(17, 30),
      color: PERSON.harbor,
      payload: { title: "Soccer practice", location: "Field 3", person: "Arjun" },
    },
    {
      ...base,
      id: "evt-4",
      type: "event",
      source: "icloud",
      starts_at: at(19, 30),
      ends_at: at(21, 30),
      color: PERSON.heather,
      payload: { title: "Movie night", person: "Family" },
    },
    {
      ...base,
      id: "evt-5",
      type: "event",
      source: "google_cal",
      starts_at: at(9, 0, 1),
      ends_at: at(10, 0, 1),
      color: PERSON.ochre,
      payload: { title: "Dentist", location: "Downtown Dental", person: "Dad" },
    },
    {
      ...base,
      id: "evt-6",
      type: "event",
      source: "school",
      starts_at: at(13, 0, 1),
      ends_at: at(15, 0, 1),
      color: PERSON.harbor,
      payload: { title: "Swim meet", location: "Aquatic Center", person: "Arjun" },
    },

    // Tasks are v2 (Google Tasks). These exercise the task-row rendering — ring
    // vs filled dot, the 0.4 fade, completed-sorts-last — so v2 is a data change.
    {
      ...base,
      id: "todo-1",
      type: "todo",
      source: "google_tasks",
      starts_at: null,
      ends_at: null,
      color: PERSON.harbor,
      payload: { title: "Pack the swim bag", person: "Arjun" },
    },
    {
      ...base,
      id: "todo-2",
      type: "todo",
      source: "google_tasks",
      starts_at: null,
      ends_at: null,
      color: PERSON.ochre,
      payload: { title: "Sign the permission slip", person: "Dad" },
    },
    {
      ...base,
      id: "todo-3",
      type: "todo",
      source: "google_tasks",
      status: "done" as const,
      starts_at: null,
      ends_at: null,
      color: PERSON.sage,
      payload: { title: "Water the garden", person: "Maya" },
    },

    {
      ...base,
      id: "wx-1",
      type: "weather",
      source: "open_meteo",
      starts_at: null,
      ends_at: null,
      color: null,
      payload: { tempC: 24, tempF: 75, code: 1, summary: "Mainly clear", hiF: 79, loF: 61 },
    },
  ];
}
