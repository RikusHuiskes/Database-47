import SwiftUI

@main struct CoteDeDurasApp: App {
    @StateObject private var model = AppModel()
    @StateObject private var favourites = FavouritesStore(ephemeral: AppConfiguration.testMode)
    var body: some Scene { WindowGroup { ContentView().environmentObject(model).environmentObject(favourites) } }
}
