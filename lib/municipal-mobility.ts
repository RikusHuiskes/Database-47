export function mobilityType(tags: Record<string, string>): string | undefined {
  if (tags.disused === "yes" || tags.abandoned === "yes" || ["private", "no"].includes(tags.access)) return;
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.amenity === "fuel") return "fuel";
  if (tags.amenity === "charging_station" && tags.motorcar !== "no") return "charging";
  if (tags.amenity === "parking_space" && (tags.parking_space === "disabled" || ["yes", "designated"].includes(tags.disabled))) return "disabled_parking";
  if (tags.amenity === "parking") return "parking";
  if (tags.highway === "bus_stop" || tags.amenity === "bus_station" || ["station", "halt", "tram_stop"].includes(tags.railway) || tags.public_transport === "platform") return "public_transport";
}

export function mobilityTypes(tags: Record<string, string>): string[] {
  const type = mobilityType(tags);
  if (!type) return [];
  // A car park may supply both a general parking card and a sourced card
  // for its reserved bays. Wheelchair access alone is not evidence of bays.
  const disabled = tags["capacity:disabled"] === "yes" || Number(tags["capacity:disabled"]) > 0;
  return type === "parking" && disabled ? [type, "disabled_parking"] : [type];
}

export function mobilityName(tags: Record<string, string>): string | undefined {
  const type = mobilityType(tags);
  const label = type === "supermarket" ? "Supermarkt" : type === "fuel" ? "Tankstation" : type === "charging" ? "Laadstation" : type === "parking" ? "Parkeerterrein" : type === "disabled_parking" ? "Invalide parkeerplaats" : tags.railway ? "Trein- of tramhalte" : "Bushalte";
  return type ? tags.name || tags["name:fr"] || [label, tags["addr:street"] || tags.brand || tags.operator || tags.network || tags.ref].filter(Boolean).join(" · ") : undefined;
}

export function mobilityDetails(tags: Record<string, string>): string | undefined {
  const details: string[] = [];
  if (tags.access === "customers") details.push("Alleen voor klanten; controleer de toegangsvoorwaarden.");
  if (tags.amenity === "parking" || tags.amenity === "parking_space") {
    if (Number(tags.capacity) > 0) details.push(`Capaciteit volgens bron: ${tags.capacity} plaatsen.`);
    if (Number(tags["capacity:disabled"]) > 0) details.push(`Gereserveerde invalide parkeerplaatsen volgens bron: ${tags["capacity:disabled"]}.`);
    else if (tags["capacity:disabled"] === "yes") details.push("Gereserveerde invalide parkeerplaatsen aanwezig volgens bron; aantal niet vermeld.");
    if (tags.fee === "yes") details.push("Betaald parkeren volgens bron; controleer het actuele tarief ter plaatse.");
    if (tags.fee === "no") details.push("Gratis parkeren volgens bron.");
    details.push("De kaartbron bevestigt geen actuele vrije parkeerplaatsen; controleer de bebording ter plaatse.");
  }
  if (mobilityType(tags) === "public_transport") {
    if (tags.network || tags.operator) details.push(`Netwerk / vervoerder: ${tags.network || tags.operator}.`);
    if (tags.ref) details.push(`Haltenummer: ${tags.ref}.`);
    details.push("Raadpleeg de vervoerder voor actuele lijnen en vertrektijden.");
  }
  if (tags.amenity === "charging_station") {
    if (tags.capacity) details.push(`Aantal laadplaatsen volgens bron: ${tags.capacity}.`);
    const sockets = Object.entries(tags).filter(([key,value]) => /^socket:[^:]+$/.test(key) && value !== "no" && value !== "0")
      .map(([key]) => key.replace("socket:", "").replaceAll("_", " "));
    if (sockets.length) details.push(`Aansluitingen: ${sockets.join(", ")}.`);
    details.push("Controleer beschikbaarheid, laadvermogen en tarieven bij de exploitant.");
  }
  return details.join(" ") || undefined;
}
