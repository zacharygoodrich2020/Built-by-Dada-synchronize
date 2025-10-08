import { google } from "googleapis";
import fs from "fs";
let oAuth2Client;

export function initGoogle({ clientId, clientSecret, redirectUri }) {
  oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  try {
    const raw = fs.readFileSync("data/tokens.json", "utf-8");
    oAuth2Client.setCredentials(JSON.parse(raw));
  } catch {}
  oAuth2Client.on("tokens", (tokens) => {
    if (!fs.existsSync("data")) fs.mkdirSync("data");
    fs.writeFileSync("data/tokens.json", JSON.stringify(tokens, null, 2));
  });
  return oAuth2Client;
}

export function getGoogleAuthUrl(
  scopes = ["https://www.googleapis.com/auth/calendar"]
) {
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });
}

export async function handleGoogleCallback(code) {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  return tokens;
}

export async function listGoogleCalendars() {
  const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
  const res = await calendar.calendarList.list();
  return res.data.items || [];
}

export async function listGoogleEvents({
  calendarId = "primary",
  timeMin,
  timeMax,
  syncToken,
}) {
  const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
  const params = { calendarId, singleEvents: false, maxResults: 2500 };
  if (syncToken) params.syncToken = syncToken;
  else {
    const now = new Date();
    params.timeMin = new Date(now.getFullYear() - 1, 0, 1).toISOString();
    params.timeMax = new Date(now.getFullYear() + 1, 0, 1).toISOString();
  }
  const res = await calendar.events.list(params);
  return res.data;
}

export async function upsertGoogleEvent({ calendarId = "primary", event }) {
  const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
  if (event.id) {
    const { data } = await calendar.events.update({
      calendarId,
      eventId: event.id,
      requestBody: event,
    });
    return data;
  } else {
    const { data } = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    return data;
  }
}
