import { createDAVClient } from "tsdav";
import { v4 as uuid } from "uuid";

let client;
export async function initIcloud({ email, appPassword }) {
  client = await createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username: email, password: appPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  const principal = await client.fetchPrincipal();
  const calendars = await client.fetchCalendars();
  return { principal, calendars };
}

export async function listIcloudEvents({ calendar, syncToken }) {
  if (syncToken) {
    const { objects, newSyncToken } = await client.syncCalendar({
      calendar,
      syncLevel: 1,
      syncToken,
    });
    return { events: objects, syncToken: newSyncToken };
  } else {
    const objects = await client.fetchCalendarObjects({ calendar });
    const token = await client.getCalendarSyncToken({ calendar });
    return { events: objects, syncToken: token };
  }
}

export async function upsertIcloudEvent({
  calendar,
  icalendarString,
  href,
}) {
  if (href) {
    await client.updateCalendarObject({
      calendarObject: { calendar, href, data: icalendarString },
    });
    return { href };
  } else {
    const newHref = `${uuid()}.ics`;
    await client.createCalendarObject({
      calendar,
      filename: newHref,
      iCalString: icalendarString,
    });
    return { href: newHref };
  }
}
