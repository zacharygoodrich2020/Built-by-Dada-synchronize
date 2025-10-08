import { v4 as uuid } from "uuid";
import { DateTime } from "luxon";
import {
  getState,
  setState,
  getMapping,
  upsertMapping,
} from "./db.js";
import {
  listGoogleEvents,
  upsertGoogleEvent,
} from "./providers/google.js";
import {
  listIcloudEvents,
  upsertIcloudEvent,
} from "./providers/icloud.js";

function iso(dt) {
  return DateTime.fromISO(dt || DateTime.now().toISO()).toUTC().toISO();
}

function gToICal(g) {
  const uid = g.id || uuid();
  const dtStart = g.start?.dateTime || g.start?.date + "T00:00:00Z";
  const dtEnd = g.end?.dateTime || g.end?.date + "T23:59:00Z";
  const sum = (g.summary || "").replace(/\n/g, " ");
  const desc = (g.description || "").replace(/\n/g, "\\n");
  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//BuiltByDadaSync//EN\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${DateTime.now()
    .toUTC()
    .toFormat("yyyyMMdd'T'HHmmss'Z'")}\nDTSTART:${DateTime.fromISO(dtStart)
    .toUTC()
    .toFormat("yyyyMMdd'T'HHmmss'Z'")}\nDTEND:${DateTime.fromISO(dtEnd)
    .toUTC()
    .toFormat("yyyyMMdd'T'HHmmss'Z'")}\nSUMMARY:${sum}\nDESCRIPTION:${desc}\nEND:VEVENT\nEND:VCALENDAR`;
}

function iCalToG(obj) {
  const s = obj.data;
  const get = (re) => (s.match(re) || [])[1];
  const uid = get(/\nUID:([^\n]+)/);
  const summary = get(/\nSUMMARY:([^\n]+)/) || "";
  const description = (get(/\nDESCRIPTION:([^\n]+)/) || "").replace(
    /\\n/g,
    "\n"
  );
  const dtstart = get(/\nDTSTART:([^\n]+)/);
  const dtend = get(/\nDTEND:([^\n]+)/);
  const toISO = (yyyymmddhhmm) => {
    const dt = DateTime.fromFormat(
      yyyymmddhhmm,
      "yyyyLLdd'T'HHmmss'Z'",
      { zone: "utc" }
    );
    return dt.isValid ? dt.toISO() : null;
  };
  return {
    id: uid,
    summary,
    description,
    start: { dateTime: toISO(dtstart) },
    end: { dateTime: toISO(dtend) },
  };
}

export async function syncIcloudToGoogle({
  icloudCalendar,
  googleCalendarId,
}) {
  const iKey = `icloud.syncToken.${icloudCalendar?.url}`;
  const prevToken = getState(iKey);
  const { events, syncToken } = await listIcloudEvents({
    calendar: icloudCalendar,
    syncToken: prevToken,
  });
  for (const ev of events) {
    if (!ev || !ev.data || !/BEGIN:VEVENT/.test(ev.data)) continue;
    const gCandidate = iCalToG(ev);
    const map = getMapping("icloud", gCandidate.id);
    if (!map) {
      const gCreated = await upsertGoogleEvent({
        calendarId: googleCalendarId,
        event: { ...gCandidate, id: undefined },
      });
      upsertMapping({
        source: "icloud",
        source_event_id: gCandidate.id,
        target: "google",
        target_event_id: gCreated.id,
        updated_at: iso(gCreated.updated),
      });
    } else {
      await upsertGoogleEvent({
        calendarId: googleCalendarId,
        event: { ...gCandidate, id: map.target_event_id },
      });
    }
  }
  setState(iKey, syncToken);
}

export async function syncGoogleToIcloud({
  icloudCalendar,
  googleCalendarId,
}) {
  const data = await listGoogleEvents({ calendarId: googleCalendarId });
  const items = data.items || [];
  for (const g of items) {
    if (g.status === "cancelled") continue;
    const map = getMapping("google", g.id);
    const ical = gToICal(g);
    if (!map) {
      const { href } = await upsertIcloudEvent({
        calendar: icloudCalendar,
        icalendarString: ical,
      });
      upsertMapping({
        source: "google",
        source_event_id: g.id,
        target: "icloud",
        target_event_id: href,
        updated_at: iso(g.updated),
      });
    } else {
      await upsertIcloudEvent({
        calendar: icloudCalendar,
        icalendarString: ical,
        href: map.target_event_id,
      });
    }
  }
}
