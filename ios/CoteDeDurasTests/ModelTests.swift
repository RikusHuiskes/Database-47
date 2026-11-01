import XCTest
@testable import CoteDeDuras

final class ModelTests: XCTestCase {
    let now = ISO8601DateFormatter().date(from: "2026-11-01T12:00:00Z")!
    func event(_ id: String = "a", _ start: String = "2026-12-25") -> EventRecord { EventRecord(id: id, title: "Kerstdiner", start_at: start) }
    func testFrenchDatesAndDateOnlyValidity() {
        XCTAssertEqual(FrenchDates.day("2026-10-31T23:30:00Z"), "2026-11-01")
        XCTAssertEqual(FrenchDates.day("2026-03-29T22:30:00Z"), "2026-03-30")
        XCTAssertNil(FrenchDates.day("2026-02-31")); XCTAssertNil(FrenchDates.day("invalid"))
    }
    func testExpiredAndLongPeriods() {
        XCTAssertFalse(event("old", "2021-01-01").isCurrent(at: now))
        var long = event("long", "2021-01-01"); long.end_at = "2026-12-31"
        XCTAssertTrue(long.isLongRunning); XCTAssertTrue(long.isCurrent(at: now))
        var filter = EventFilter(); filter.when = .today
        XCTAssertEqual(filter.apply([long], now: now).count, 0)
    }
    func testWeekendAndTomorrowBoundaries() {
        var filter = EventFilter(); filter.when = .weekend
        XCTAssertEqual(filter.apply([event("sunday", "2026-11-01"), event("monday", "2026-11-02")], now: now).map(\.id), ["sunday"])
        filter.when = .tomorrow; XCTAssertEqual(filter.apply([event("sunday", "2026-11-01"), event("monday", "2026-11-02")], now: now).map(\.id), ["monday"])
    }
    func testCategoryAccentDistanceAndPromotionOrdering() {
        var far = event("far"); far.title = "Dégustation"; far.distance_km = 20; far.category_ids = ["food", "wine"]
        far.advertising_placements = [Placement(placement: "highlight", starts_at: "2026-01-01T00:00:00Z", ends_at: "2027-01-01T00:00:00Z")]
        var near = event("near"); near.distance_km = 0; near.category_ids = ["wine"]
        var filter = EventFilter(); filter.sort = .distance
        XCTAssertEqual(filter.apply([near, far], now: now).map(\.id), ["far", "near"])
        filter.query = "degustation"; filter.category = "wine"; XCTAssertEqual(filter.apply([near, far], now: now).count, 1)
        filter.radius = 10; XCTAssertEqual(filter.apply([near, far], now: now).count, 0)
    }
    func testDirectoryDoesNotBecomeDatedEvent() {
        var address = event(); address.is_directory_entry = true
        var filter = EventFilter(); filter.when = .today; XCTAssertTrue(filter.apply([address], now: now).isEmpty)
    }
    func testBackupRoundTripAndWrongSiteRejection() throws {
        let saved = SavedRecord(event: event()); let data = try BackupEnvelope.data([saved])
        XCTAssertEqual(try BackupEnvelope.read(data).map(\.id), [saved.id])
        let foreign = String(data: data, encoding: .utf8)!.replacingOccurrences(of: "cote-de-duras-favourites", with: "cote-de-sarlat-favourites")
        XCTAssertThrowsError(try BackupEnvelope.read(Data(foreign.utf8)))
        XCTAssertThrowsError(try BackupEnvelope.read(Data("{}".utf8)))
    }
    func testGuideContextSurvivesBackup() throws {
        let service = ServiceRecord(id: "pharmacy:1", type: "pharmacy", name: "Pharmacie du Château")
        let context = GuideContext(townId: "duras", serviceType: "pharmacy")
        let data = try BackupEnvelope.data([SavedRecord(service: service, context: context)])
        XCTAssertEqual(try BackupEnvelope.read(data).first?.context, context)
    }
    @MainActor func testFavouriteMergeRetainsExistingAndCapsAt200() {
        let store = FavouritesStore(ephemeral: true); let existing = SavedRecord(event: event())
        store.toggle(existing); XCTAssertEqual(store.merge([existing]), 0)
        XCTAssertEqual(store.merge((0..<210).map { SavedRecord(event: event(String($0))) }), 199)
        XCTAssertEqual(store.records.count, 200); XCTAssertEqual(store.records.first?.id, existing.id)
    }
    func testUnsafeLinksAreNotOpened() { XCTAssertNil(webURL("javascript:alert(1)")); XCTAssertNotNil(webURL("https://example.com")) }
}
