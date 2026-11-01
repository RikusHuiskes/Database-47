import Foundation
import Combine
import SwiftUI
import UniformTypeIdentifiers

struct BackupEnvelope: Codable {
    var format = "cote-de-duras-favourites"; var version = 1; let exportedAt: String; let entries: [SavedRecord]
    static func read(_ data: Data) throws -> [SavedRecord] {
        guard data.count <= 10 * 1024 * 1024 else { throw BackupError.invalid }
        let envelope = try JSONDecoder().decode(Self.self, from: data)
        guard envelope.format == "cote-de-duras-favourites", envelope.version == 1, envelope.entries.count <= 200, Set(envelope.entries.map(\.id)).count == envelope.entries.count else { throw BackupError.invalid }
        return envelope.entries
    }
    static func data(_ entries: [SavedRecord]) throws -> Data { let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; return try encoder.encode(Self(exportedAt: ISO8601DateFormatter().string(from: Date()), entries: entries)) }
}
enum BackupError: LocalizedError { case invalid; var errorDescription: String? { "Kies een geldige Cote de Duras-reservekopie van maximaal 10 MB. Bestaande favorieten blijven behouden." } }
struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }; var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { guard let data = configuration.file.regularFileContents else { throw BackupError.invalid }; self.data = data }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
@MainActor final class FavouritesStore: ObservableObject {
    @Published private(set) var records: [SavedRecord] = []; @Published var error: String?
    private let file: URL?
    init(file: URL? = nil, ephemeral: Bool = false) {
        self.file = ephemeral ? nil : (file ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("cote-de-duras-favourites-v1.json"))
        if let file = self.file, FileManager.default.fileExists(atPath: file.path) {
            do { records = Array(try JSONDecoder().decode([SavedRecord].self, from: Data(contentsOf: file)).prefix(200)) } catch { self.error = "Je bewaarde gegevens konden niet worden gelezen. Bewaar eerst een reservekopie van je bestaande bestand als je hulp nodig hebt." }
        }
    }
    func contains(_ record: SavedRecord) -> Bool { records.contains { $0.id == record.id } }
    func toggle(_ record: SavedRecord) {
        if contains(record) { records.removeAll { $0.id == record.id } }
        else { guard records.count < 200 else { error = "Je kunt maximaal 200 favorieten bewaren."; return }; var copy = record; copy.savedAt = Date().timeIntervalSince1970 * 1000; records.insert(copy, at: 0) }
        persist()
    }
    @discardableResult func merge(_ incoming: [SavedRecord]) -> Int {
        var seen = Set(records.map(\.id)); let room = max(0, 200 - records.count); let additions = incoming.filter { seen.insert($0.id).inserted }.prefix(room); records.append(contentsOf: additions); persist(); return additions.count
    }
    func persist() {
        guard let file else { return }
        do { try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true); try JSONEncoder().encode(records).write(to: file, options: .atomic) }
        catch { self.error = "Je favorieten konden niet worden opgeslagen. Maak een reservekopie voordat je afsluit." }
    }
}
