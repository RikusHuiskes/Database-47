import { NextResponse } from "next/server";
import { EYMET_AGENDA_URL, EYMET_SOURCE_NAME, fetchEymetEvents } from "../../../lib/import-sources/eymet";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  try {
    const events = await fetchEymetEvents();
    return NextResponse.json({ events, source: EYMET_AGENDA_URL, sourceName: EYMET_SOURCE_NAME });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: `Eymet-agenda ophalen of verwerken mislukt: ${message}` }, { status: 502 });
  }
}
