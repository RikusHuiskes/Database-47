import XCTest

final class VisitorUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }
    func launch() -> XCUIApplication { let app = XCUIApplication(); app.launchArguments = ["--ui-testing"]; app.launch(); return app }
    func testAgendaFavouriteAndSearch() {
        let app = launch(); app.tabBars.buttons["Agenda"].tap()
        let search = app.textFields["agendaSearch"]; XCTAssertTrue(search.waitForExistence(timeout: 15)); search.tap(); search.typeText("Kerstdiner")
        let heart = app.buttons["favourite-4ae2d2b9-623d-4c90-9517-9d4da5d9fcc6"]
        app.scrollViews.firstMatch.swipeUp(); XCTAssertTrue(heart.waitForExistence(timeout: 10)); heart.tap()
        app.tabBars.buttons["Bewaard"].tap(); let favourites = app.textFields["favouriteSearch"]; XCTAssertTrue(favourites.waitForExistence(timeout: 10)); favourites.tap(); favourites.typeText("kerstdiner")
        XCTAssertTrue(app.staticTexts["1 van 1 favorieten"].waitForExistence(timeout: 10))
    }
    func testMunicipalityDirectoryOpensWithoutAccount() {
        let app = launch(); app.tabBars.buttons["Gemeentegids"].tap()
        let search = app.textFields["guideSearch"]; XCTAssertTrue(search.waitForExistence(timeout: 15)); search.tap(); search.typeText("Château")
        app.scrollViews.firstMatch.swipeUp(); XCTAssertTrue(app.buttons["Pharmacie du Château"].waitForExistence(timeout: 10))
        app.buttons["Pharmacie du Château"].tap(); XCTAssertTrue(app.staticTexts["Pharmacie du Château"].waitForExistence(timeout: 10))
    }
}
