export type DemoPlace = { name: string; latitude: number; longitude: number };

// Town centres used only by the isolated Amsterdam demonstration.
export const AMSTERDAM_DEMO_PLACES: DemoPlace[] = [
  { name: "Amsterdam", latitude: 52.3676, longitude: 4.9041 },
  { name: "Zaandam", latitude: 52.4385, longitude: 4.8264 },
  { name: "Haarlem", latitude: 52.3874, longitude: 4.6462 },
  { name: "Amstelveen", latitude: 52.3008, longitude: 4.8632 },
  { name: "Diemen", latitude: 52.3396, longitude: 4.9626 },
  { name: "Weesp", latitude: 52.3075, longitude: 5.0417 },
  { name: "Muiden", latitude: 52.3305, longitude: 5.0694 },
  { name: "Purmerend", latitude: 52.5050, longitude: 4.9590 },
  { name: "Volendam", latitude: 52.4967, longitude: 5.0704 },
  { name: "Edam", latitude: 52.5121, longitude: 5.0480 },
  { name: "Hoofddorp", latitude: 52.3025, longitude: 4.6887 },
  { name: "Nieuw-Vennep", latitude: 52.2640, longitude: 4.6350 },
  { name: "Aalsmeer", latitude: 52.2630, longitude: 4.7630 },
  { name: "Uithoorn", latitude: 52.2370, longitude: 4.8260 },
  { name: "Zandvoort", latitude: 52.3713, longitude: 4.5331 },
  { name: "IJmuiden", latitude: 52.4603, longitude: 4.6100 },
  { name: "Beverwijk", latitude: 52.4830, longitude: 4.6560 },
  { name: "Almere", latitude: 52.3508, longitude: 5.2647 },
  { name: "Lelystad", latitude: 52.5185, longitude: 5.4714 },
  { name: "Hilversum", latitude: 52.2292, longitude: 5.1669 },
  { name: "Bussum", latitude: 52.2730, longitude: 5.1610 },
  { name: "Naarden", latitude: 52.2950, longitude: 5.1620 },
  { name: "Leiden", latitude: 52.1601, longitude: 4.4970 },
  { name: "Utrecht", latitude: 52.0907, longitude: 5.1214 },
  { name: "Alkmaar", latitude: 52.6324, longitude: 4.7534 },
  { name: "Hoorn", latitude: 52.6424, longitude: 5.0602 },
  { name: "Amersfoort", latitude: 52.1561, longitude: 5.3878 },
  { name: "Gouda", latitude: 52.0116, longitude: 4.7105 },
  { name: "Landsmeer", latitude: 52.4307, longitude: 4.9150 },
  { name: "Oostzaan", latitude: 52.4390, longitude: 4.8790 },
  { name: "Monnickendam", latitude: 52.4580, longitude: 5.0370 },
  { name: "Lisse", latitude: 52.2560, longitude: 4.5570 },
  { name: "Woerden", latitude: 52.0850, longitude: 4.8830 },
  { name: "Vinkeveen", latitude: 52.2150, longitude: 4.9340 },
  { name: "Abcoude", latitude: 52.2720, longitude: 4.9700 },
];

export function distanceKm(
  a: Pick<DemoPlace, "latitude" | "longitude">,
  b: Pick<DemoPlace, "latitude" | "longitude">,
): number {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function findDemoPlace(name: string): DemoPlace | undefined {
  return AMSTERDAM_DEMO_PLACES.find((place) => place.name === name);
}
