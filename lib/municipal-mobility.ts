export function mobilityType(tags: Record<string, string>): string | undefined {
  if (tags.disused === "yes" || tags.abandoned === "yes" || ["private", "no"].includes(tags.access)) return;
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.amenity === "fuel") return "fuel";
  if (tags.amenity === "charging_station" && tags.motorcar !== "no") return "charging";
}

export function mobilityName(tags: Record<string, string>): string | undefined {
  const type = mobilityType(tags);
  const label = type === "supermarket" ? "Supermarkt" : type === "fuel" ? "Tankstation" : type === "charging" ? "Laadstation" : undefined;
  return type ? tags.name || tags["name:fr"] || [label, tags.brand || tags.operator || tags.network || tags.ref].filter(Boolean).join(" · ") : undefined;
}

export function mobilityDetails(tags: Record<string, string>): string | undefined {
  const details: string[] = [];
  if (tags.access === "customers") details.push("Alleen voor klanten; controleer de toegangsvoorwaarden.");
  if (tags.amenity === "charging_station") {
    if (tags.capacity) details.push(`Aantal laadplaatsen volgens bron: ${tags.capacity}.`);
    const sockets = Object.entries(tags).filter(([key,value]) => /^socket:[^:]+$/.test(key) && value !== "no" && value !== "0")
      .map(([key]) => key.replace("socket:", "").replaceAll("_", " "));
    if (sockets.length) details.push(`Aansluitingen: ${sockets.join(", ")}.`);
    details.push("Controleer beschikbaarheid, laadvermogen en tarieven bij de exploitant.");
  }
  return details.join(" ") || undefined;
}
