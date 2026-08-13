// The ICS parser is NOT duplicated any more. The canonical copy lives at
// supabase/functions/_shared/ics.ts so the Deno Edge Function can import it
// without the Supabase CLI walking outside its bundle root; this file is the
// browser-side view of it. See MODULES.md § The ingest twin.
export {
  parseIcs,
  fetchFeeds,
  looksLikeIcs,
  assertUniqueSources,
  windowFor,
  splitPerson,
  unknownPersonPrefixes,
  WINDOW_BACK_DAYS,
  WINDOW_FORWARD_DAYS,
  type CalendarFeed,
  type IcsEntry,
  type ParseOptions,
  type FeedOutcome,
  type PeopleMap,
} from "../../../supabase/functions/_shared/ics.ts";
