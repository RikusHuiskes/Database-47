import Foundation
import Combine
import CryptoKit

struct Loaded<Value> { let value: Value; let cached: Bool; let updated: Date }
enum AppFailure: LocalizedError {
    case invalidConfiguration, unavailable, unreadable
    var errorDescription: String? { switch self { case .invalidConfiguration: return "De gegevensverbinding is nog niet ingericht voor deze appversie."; case .unavailable: return "De gegevens zijn nu niet bereikbaar. Probeer het opnieuw."; case .unreadable: return "De gegevens konden niet worden gelezen." } }
}
enum AppConfiguration {
    static var apiBase: URL? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "AppAPIBaseURL") as? String, let url = URL(string: raw), url.scheme == "https", url.host != nil else { return nil }; return url
    }
    static var testMode: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.arguments.contains("--ui-testing")
        #else
        return false
        #endif
    }
}
actor APIClient {
    private let base: URL?
    init(base: URL? = AppConfiguration.apiBase) { self.base = base }
    func load<Value: Decodable>(_ path: String, query: [URLQueryItem] = [], as type: Value.Type) async throws -> Loaded<Value> {
        guard let base, var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false) else { throw AppFailure.invalidConfiguration }
        components.queryItems = query.isEmpty ? nil : query; guard let url = components.url else { throw AppFailure.invalidConfiguration }
        let hash = SHA256.hash(data: Data(url.absoluteString.utf8)).map { String(format: "%02x", $0) }.joined()
        let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("PublicData", isDirectory: true)
        let file = directory.appendingPathComponent(hash + ".json")
        do {
            var request = URLRequest(url: url); request.timeoutInterval = 50; request.cachePolicy = .reloadIgnoringLocalCacheData; request.setValue("application/json", forHTTPHeaderField: "Accept")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode), http.mimeType == "application/json", data.count < 30_000_000 else { throw AppFailure.unavailable }
            let decoded = try JSONDecoder().decode(Value.self, from: data)
            try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true); try? data.write(to: file, options: .atomic)
            return Loaded(value: decoded, cached: false, updated: Date())
        } catch {
            if Task.isCancelled { throw CancellationError() }
            if let data = try? Data(contentsOf: file), let decoded = try? JSONDecoder().decode(Value.self, from: data) {
                let date = (try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                return Loaded(value: decoded, cached: true, updated: date)
            }
            throw error
        }
    }
}
@MainActor final class AppModel: ObservableObject {
    @Published var events: [EventRecord] = []; @Published var categories: [Category] = []; @Published var services: [ServiceRecord] = []
    @Published var loading = false; @Published var guideLoading = false; @Published var error: String?; @Published var guideError: String?
    @Published var categoryError: String?; @Published var cached = false; @Published var guideCached = false; @Published var updated: Date?
    @Published var guideContext: GuideContext?; @Published var notice: String?
    let client: APIClient; var guideRequest = UUID()
    init(client: APIClient = APIClient()) { self.client = client }
    func load() async {
        if loading { return }; loading = true; error = nil; categoryError = nil
        defer { loading = false }
        if AppConfiguration.testMode {
            events = (try? fixture("events", as: EventsResponse.self).events) ?? []; categories = (try? fixture("categories", as: CategoriesResponse.self).categories) ?? []; updated = AppClock.now; return
        }
        async let eventResult = client.load("api/nearby-events", as: EventsResponse.self)
        async let categoryResult = client.load("api/ios-categories", as: CategoriesResponse.self)
        do { let result = try await eventResult; events = result.value.events; cached = result.cached; updated = result.updated } catch { self.error = "De agenda kon niet worden vernieuwd. \(error.localizedDescription)" }
        do { let result = try await categoryResult; categories = result.value.categories.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending } } catch { categoryError = "Categorieën zijn nu niet bereikbaar. Andere filters blijven beschikbaar." }
    }
    func loadGuide(town: Town, type: String) async {
        let request = UUID(); guideRequest = request; guideLoading = true; guideError = nil; services = []; guideContext = nil
        defer { if guideRequest == request { guideLoading = false } }
        if AppConfiguration.testMode { services = (try? fixture("guide", as: GuideResponse.self).services) ?? []; guideContext = GuideContext(townId: town.id, serviceType: type); return }
        do {
            let result = try await client.load("api/municipality-services", query: [URLQueryItem(name: "codeInsee", value: town.code_insee), URLQueryItem(name: "service", value: type)], as: GuideResponse.self)
            guard guideRequest == request, !Task.isCancelled else { return }; services = result.value.services; guideCached = result.cached; guideContext = GuideContext(townId: town.id, serviceType: type)
        } catch { if guideRequest == request, !Task.isCancelled { guideError = "De gemeentegids kon niet worden geladen. Probeer het opnieuw." } }
    }
    func current(_ record: SavedRecord) -> SavedRecord {
        guard let event = record.event, let live = events.first(where: { $0.id == event.id }) else { return record }
        var result = record; result.event = live; return result
    }
    func shareURL(_ record: SavedRecord) -> URL? {
        guard let base = AppConfiguration.apiBase else { return nil }; var components = URLComponents(url: base.appendingPathComponent("ios-preview"), resolvingAgainstBaseURL: false)
        if let event = record.event { components?.queryItems = [URLQueryItem(name: "event", value: event.id)] }
        else if let service = record.service, let context = record.context { components?.queryItems = [URLQueryItem(name: "town", value: context.townId), URLQueryItem(name: "type", value: context.serviceType), URLQueryItem(name: "service", value: service.id)] }
        else if let source = webURL(record.service?.website ?? record.service?.sourceUrl) { return source }
        return components?.url
    }
    private func fixture<Value: Decodable>(_ name: String, as type: Value.Type) throws -> Value {
        guard let url = Bundle.main.url(forResource: "fixture-" + name, withExtension: "json") else { throw AppFailure.unreadable }; return try JSONDecoder().decode(type, from: Data(contentsOf: url))
    }
}
