import Foundation

struct Category: Codable, Identifiable, Hashable { let id: String; let name: String; let slug: String? }
struct Town: Codable, Identifiable, Hashable {
    let id: String; let name: String; let postcode: String; let code_insee: String; let latitude: Double; let longitude: Double
    static var all: [Town] {
        guard let url = Bundle.main.url(forResource: "towns", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [] }
        return ((try? JSONDecoder().decode([Town].self, from: data)) ?? []).sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }
}
struct Placement: Codable, Hashable { let placement: String; let starts_at: String; let ends_at: String }
struct EventRecord: Codable, Identifiable, Hashable {
    let id: String; let title: String; let start_at: String
    var end_at: String?; var is_directory_entry: Bool?; var city: String?; var address: String?
    var short_description: String?; var description: String?; var image_url: String?; var is_free: Bool?
    var website_url: String?; var booking_url: String?; var contact_phone: String?; var source_url: String?
    var distance_km: Double?; var category_ids: [String]?; var category_id: String?
    var advertising_placements: [Placement]?; var promotion_type: String?; var promotion_status: String?
    var promotion_start_at: String?; var promotion_end_at: String?
    var isDirectory: Bool { is_directory_entry == true }
    func isCurrent(at now: Date = AppClock.now) -> Bool {
        if isDirectory { return true }
        guard let start = FrenchDates.day(start_at), let end = FrenchDates.day(end_at ?? start_at), end >= start else { return false }
        let relevant = end_at ?? start_at
        if FrenchDates.dateOnly(relevant) { return end >= FrenchDates.dayString(now) }
        return (FrenchDates.instant(relevant) ?? .distantPast) >= now
    }
    var isLongRunning: Bool {
        guard !isDirectory, let start = FrenchDates.dayDate(start_at), let end = FrenchDates.dayDate(end_at ?? "") else { return false }
        return end.timeIntervalSince(start) > 366 * 86400
    }
    func highlighted(at now: Date = AppClock.now) -> Bool {
        if promotion_status == "ended" { return false }
        if let placements = advertising_placements {
            return placements.contains { $0.placement == "highlight" && (FrenchDates.instant($0.starts_at) ?? .distantFuture) <= now && now < (FrenchDates.instant($0.ends_at) ?? .distantPast) }
        }
        return promotion_type == "highlight" && promotion_status == "active" && (promotion_start_at.flatMap(FrenchDates.instant) ?? .distantPast) <= now && now < (promotion_end_at.flatMap(FrenchDates.instant) ?? .distantFuture)
    }
    var dateLabel: String {
        if isDirectory { return "Het hele jaar ontdekken" }
        guard let start = FrenchDates.day(start_at), let end = FrenchDates.day(end_at ?? start_at) else { return "Datum bij de organisator" }
        let today = FrenchDates.dayString(AppClock.now)
        if end < today { return "Afgelopen · \(FrenchDates.display(end))" }
        if isLongRunning { return "Langlopende activiteit · dagen bij de organisator" }
        if end > start { return start < today ? "Loopt t/m \(FrenchDates.display(end))" : "\(FrenchDates.display(start)) t/m \(FrenchDates.display(end))" }
        return FrenchDates.display(start)
    }
    var canAddToCalendar: Bool {
        guard !isDirectory, !isLongRunning, isCurrent(), let start = FrenchDates.day(start_at), let first = FrenchDates.dayDate(start_at), let last = FrenchDates.dayDate(end_at ?? start_at) else { return false }
        return start >= FrenchDates.dayString(AppClock.now) && last.timeIntervalSince(first) <= 31 * 86400
    }
}
struct ServiceRecord: Codable, Identifiable, Hashable {
    let id: String; let type: String; let name: String
    var address: String?; var municipality: String?; var phone: String?; var email: String?; var website: String?
    var openingHours: String?; var sourceUrl: String?; var image_url: String?; var image_source_url: String?
    var image_credit: String?; var image_license: String?; var image_license_url: String?; var distanceKm: Double?; var highlighted: Bool?
}
struct GuideContext: Codable, Hashable { let townId: String; let serviceType: String }
struct SavedRecord: Codable, Identifiable, Hashable {
    var kind: String; var event: EventRecord?; var service: ServiceRecord?; var savedAt: Double?; var context: GuideContext?
    var id: String { kind + ":" + (event?.id ?? service?.id ?? "") }
    var title: String { event?.title ?? service?.name ?? "Vermelding" }
    var place: String { event?.city ?? service?.municipality ?? "Omgeving Duras" }
    var address: String { event?.address ?? service?.address ?? "" }
    var image: String? { event?.image_url ?? service?.image_url }
    init(event: EventRecord) { kind = "event"; self.event = event }
    init(service: ServiceRecord, context: GuideContext?) { kind = "service"; self.service = service; self.context = context }
    enum CodingKeys: String, CodingKey { case kind, item, savedAt, context }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self); kind = try values.decode(String.self, forKey: .kind)
        savedAt = try values.decodeIfPresent(Double.self, forKey: .savedAt); context = try values.decodeIfPresent(GuideContext.self, forKey: .context)
        if kind == "event" { event = try values.decode(EventRecord.self, forKey: .item) }
        else if kind == "service" { service = try values.decode(ServiceRecord.self, forKey: .item) }
        else { throw DecodingError.dataCorruptedError(forKey: .kind, in: values, debugDescription: "Onbekend soort vermelding") }
    }
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self); try values.encode(kind, forKey: .kind)
        try values.encodeIfPresent(savedAt, forKey: .savedAt); try values.encodeIfPresent(context, forKey: .context)
        if let event { try values.encode(event, forKey: .item) } else if let service { try values.encode(service, forKey: .item) }
    }
}
struct EventsResponse: Decodable { let events: [EventRecord] }
struct CategoriesResponse: Decodable { let categories: [Category] }
struct GuideResponse: Decodable { let city: String; let services: [ServiceRecord] }

enum AppClock {
    static var now: Date {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--ui-testing") { return ISO8601DateFormatter().date(from: "2026-11-01T12:00:00Z")! }
        #endif
        return Date()
    }
}
enum FrenchDates {
    // Formatters are configured once and never mutated after initialization.
    private static let fractionalISO: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private static let plainISO: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f }()
    private static let dayFormatter: DateFormatter = { let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "Europe/Paris")!; f.dateFormat = "yyyy-MM-dd"; f.isLenient = false; return f }()
    static var calendar: Calendar { var value = Calendar(identifier: .gregorian); value.timeZone = TimeZone(identifier: "Europe/Paris")!; return value }
    static func dateOnly(_ value: String) -> Bool { value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil }
    static func instant(_ value: String) -> Date? {
        fractionalISO.date(from: value) ?? plainISO.date(from: value)
    }
    static func dayString(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }
    static func day(_ raw: String) -> String? {
        if dateOnly(raw) {
            guard let parsed = dayFormatter.date(from: raw), dayFormatter.string(from: parsed) == raw else { return nil }; return raw
        }
        return instant(raw).map(dayString)
    }
    static func dayDate(_ raw: String) -> Date? {
        guard let day = day(raw) else { return nil }; let pieces = day.split(separator: "-").compactMap { Int($0) }; guard pieces.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: pieces[0], month: pieces[1], day: pieces[2], hour: 12))
    }
    static func display(_ day: String) -> String {
        guard let date = dayDate(day) else { return "Datum onbekend" }; let formatter = DateFormatter(); formatter.locale = Locale(identifier: "nl_NL"); formatter.timeZone = calendar.timeZone; formatter.dateStyle = .long; return formatter.string(from: date)
    }
    static func plusDays(_ date: Date, _ days: Int) -> Date { calendar.date(byAdding: .day, value: days, to: date)! }
}
func normalized(_ value: String) -> String { value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "nl_NL")).trimmingCharacters(in: .whitespacesAndNewlines) }
func webURL(_ value: String?, base: URL? = nil) -> URL? {
    guard let value, let url = URL(string: value, relativeTo: base)?.absoluteURL, ["http", "https"].contains(url.scheme?.lowercased() ?? "") else { return nil }; return url
}
enum DateChoice: String, CaseIterable, Identifiable { case all = "Alle data & adressen", today = "Vandaag", tomorrow = "Morgen", week = "Komende 7 dagen", weekend = "Dit weekend"; var id: String { rawValue } }
enum SortChoice: String, CaseIterable, Identifiable { case date = "Eerstvolgende datum", distance = "Dichtst bij Duras", name = "Alfabetisch"; var id: String { rawValue } }
struct EventFilter: Equatable {
    var query = ""; var category = ""; var place = ""; var radius = 50.0; var freeOnly = false; var kind = "all"; var when = DateChoice.all; var sort = SortChoice.date
    func matchesDate(_ event: EventRecord, now: Date) -> Bool {
        if when == .all { return true }; if event.isDirectory || event.isLongRunning { return false }
        guard let start = FrenchDates.day(event.start_at), let end = FrenchDates.day(event.end_at ?? event.start_at) else { return false }
        let cal = FrenchDates.calendar; let today = cal.startOfDay(for: now); var first = today; var last = today
        switch when {
        case .tomorrow: first = FrenchDates.plusDays(today, 1); last = first
        case .week: last = FrenchDates.plusDays(today, 6)
        case .weekend: let weekday = cal.component(.weekday, from: today); first = FrenchDates.plusDays(today, weekday == 1 ? -1 : (7 - weekday + 7) % 7); last = FrenchDates.plusDays(first, 1)
        default: break
        }
        return start <= FrenchDates.dayString(last) && end >= FrenchDates.dayString(first)
    }
    func apply(_ input: [EventRecord], now: Date = AppClock.now) -> [EventRecord] {
        input.filter { event in
            guard event.isCurrent(at: now), matchesDate(event, now: now) else { return false }
            if kind == "events" && event.isDirectory || kind == "addresses" && !event.isDirectory { return false }
            if !category.isEmpty && !(event.category_ids ?? [event.category_id].compactMap { $0 }).contains(category) { return false }
            if !place.isEmpty && normalized(event.city ?? "") != normalized(place) { return false }
            if radius < 50 && (event.distance_km ?? .infinity) > radius { return false }
            if freeOnly && event.is_free != true { return false }
            return query.isEmpty || normalized([event.title, event.city ?? "", event.address ?? "", event.short_description ?? ""].joined(separator: " ")).contains(normalized(query))
        }.sorted { left, right in
            if left.highlighted(at: now) != right.highlighted(at: now) { return left.highlighted(at: now) }
            if sort == .distance && left.distance_km != right.distance_km { return (left.distance_km ?? .infinity) < (right.distance_km ?? .infinity) }
            if sort == .name { return left.title.localizedStandardCompare(right.title) == .orderedAscending }
            if left.isDirectory != right.isDirectory { return !left.isDirectory }
            let first = max(FrenchDates.instant(left.start_at) ?? FrenchDates.dayDate(left.start_at) ?? now, now), second = max(FrenchDates.instant(right.start_at) ?? FrenchDates.dayDate(right.start_at) ?? now, now)
            return first == second ? left.title.localizedStandardCompare(right.title) == .orderedAscending : first < second
        }
    }
}
struct ServiceType: Identifiable, Hashable {
    let id: String; let name: String
    static let all: [ServiceType] = [("all","Alle soorten"),("pharmacy","Apotheek"),("bakery","Bakkerij"),("library","Bibliotheek"),("florist","Bloemist"),("diy","Bouwmarkten"),("hospital","Dichtstbijzijnde ziekenhuis"),("mairie","Gemeentehuis & burgemeester"),("doctor","Huisarts / medisch centrum"),("disabled_parking","Invalide parkeerplaatsen"),("jeweller","Juwelier"),("hairdresser","Kapper"),("church","Kerk & diensttijden"),("charging","Laadpalen"),("estate_agent","Makelaars"),("fashion","Mode"),("tourism","Office de tourisme"),("public_transport","Openbaar vervoer"),("parking","Parkeren"),("shoes","Schoenenwinkel"),("butcher","Slagerij"),("souvenirs","Souvenirswinkel"),("supermarket","Supermarkten"),("tobacco","Tabak / Kiosk"),("dentist","Tandarts"),("fuel","Tankstations")].map { ServiceType(id: $0.0, name: $0.1) }
    static func name(_ type: String) -> String { all.first { $0.id == type }?.name ?? "Adres" }
}
