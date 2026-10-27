import { NextResponse } from "next/server";
import { fetchTourismeDurasEvents, TOURISME_DURAS_AGENDA_URL } from "../../../lib/tourisme-duras-source";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 300;

export async function GET() {
  try {
    const events = await fetchTourismeDurasEvents();
    return NextResponse.json({ events, source: TOURISME_DURAS_AGENDA_URL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ error: `Agenda ophalen of verwerken mislukt: ${message}` }, { status: 502 });
  }
}
