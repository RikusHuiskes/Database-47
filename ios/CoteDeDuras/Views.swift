import SwiftUI
import UniformTypeIdentifiers

extension Color {
    static let durasGreen = Color(red: 0.13, green: 0.29, blue: 0.23)
    static let durasCream = Color(red: 0.985, green: 0.975, blue: 0.945)
    static let durasGold = Color(red: 0.59, green: 0.39, blue: 0.22)
}
struct AppToolbar: ViewModifier {
    let showInfo: () -> Void
    func body(content: Content) -> some View {
        content.navigationBarTitleDisplayMode(.inline).toolbar {
            ToolbarItem(placement: .principal) { HStack(spacing: 9) { Image("Brand").resizable().scaledToFit().frame(width: 36, height: 36); VStack(alignment: .leading, spacing: 1) { Text("Cote de Duras").font(.headline); Text("Duras & omgeving · 50 km").font(.caption2).foregroundStyle(.secondary) } } }
            ToolbarItem(placement: .topBarTrailing) { Button(action: showInfo) { Image(systemName: "info.circle") }.accessibilityLabel("Over deze app") }
        }.background(Color.durasCream)
    }
}
struct ContentView: View {
    @EnvironmentObject var model: AppModel; @EnvironmentObject var favourites: FavouritesStore
    @State private var tab = 0; @State private var filter = EventFilter(); @State private var selected: SavedRecord?; @State private var info = false
    var body: some View {
        TabView(selection: $tab) {
            DiscoverView(showInfo: { info = true }, select: { selected = $0 }, openAgenda: { tab = 1 }, openCategory: { category in filter = EventFilter(); filter.category = category; tab = 1 }, openGuide: { tab = 2 })
                .tabItem { Label("Ontdek", systemImage: "house") }.tag(0)
            AgendaView(filter: $filter, showInfo: { info = true }, select: { selected = $0 }).tabItem { Label("Agenda", systemImage: "calendar") }.tag(1)
            GuideView(showInfo: { info = true }, select: { selected = $0 }).tabItem { Label("Gemeentegids", systemImage: "mappin.and.ellipse") }.tag(2)
            FavouritesView(showInfo: { info = true }, select: { selected = $0 }).tabItem { Label("Bewaard", systemImage: "heart") }.tag(3)
        }.tint(.durasGreen).preferredColorScheme(.light)
        .sheet(item: $selected) { ListingDetail(record: $0).environmentObject(model).environmentObject(favourites) }
        .sheet(isPresented: $info) { AppInformation() }
        .task { if model.events.isEmpty { await model.load() } }
        .alert("Cote de Duras", isPresented: Binding(get: { model.notice != nil || favourites.error != nil }, set: { if !$0 { model.notice = nil; favourites.error = nil } })) { Button("Begrepen") { model.notice = nil; favourites.error = nil } } message: { Text(model.notice ?? favourites.error ?? "") }
    }
}
struct DataStatus: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        if let error = model.error { VStack(alignment: .leading, spacing: 8) { Text(error); Button("Opnieuw proberen") { Task { await model.load() } } }.font(.footnote).padding().background(Color.orange.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 14)) }
        else if model.cached { Text("Bewaarde gegevens worden getoond. Vernieuw zodra je verbinding hebt.").font(.footnote).padding().background(Color.orange.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 14)) }
    }
}
struct SectionTitle: View {
    let title: String
    var body: some View { Text(title).font(.system(.title2, design: .serif)).foregroundStyle(Color.durasGreen).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6) }
}
struct DiscoverView: View {
    @EnvironmentObject var model: AppModel
    let showInfo: () -> Void; let select: (SavedRecord) -> Void; let openAgenda: () -> Void; let openCategory: (String) -> Void; let openGuide: () -> Void
    var upcoming: [EventRecord] { model.events.filter { !$0.isDirectory && !$0.isLongRunning && $0.isCurrent() && (FrenchDates.day($0.start_at) ?? "") >= FrenchDates.dayString(AppClock.now) }.sorted { $0.start_at < $1.start_at } }
    var body: some View {
        NavigationStack {
            ScrollView { LazyVStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 12) { Text("BONJOUR, ONTDEK DE STREEK").font(.caption).tracking(2); Text("Mooi dichtbij.").font(.system(.largeTitle, design: .serif)).bold(); Text("Evenementen en praktische adressen binnen 50 kilometer rond Duras."); Button("Bekijk de agenda →", action: openAgenda).buttonStyle(.borderedProminent) }.frame(maxWidth: .infinity, alignment: .leading).padding(24).background(Color.durasGreen).foregroundStyle(.white).clipShape(RoundedRectangle(cornerRadius: 24))
                DataStatus()
                SectionTitle(title: "Alles bij de hand")
                Button(action: openGuide) { Label("Open de gemeentegids", systemImage: "mappin.and.ellipse").frame(maxWidth: .infinity, alignment: .leading).padding() }.buttonStyle(.bordered)
                SectionTitle(title: "Ontdek op jouw manier")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(["restaurants-gastronomie", "wijnhuizen", "concerts-musique", "nature-randonnee"], id: \.self) { slug in
                        if let category = model.categories.first(where: { $0.slug == slug }) { Button { openCategory(category.id) } label: { Text(category.name + " →").font(.system(.headline, design: .serif)).frame(maxWidth: .infinity, minHeight: 65, alignment: .leading).padding(12).background(Color.durasGold.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 16)) }.buttonStyle(.plain) }
                    }
                }
                SectionTitle(title: "Binnenkort in de buurt")
                if model.loading { ProgressView("De agenda wordt geladen…") }
                else if upcoming.isEmpty && model.error == nil { ContentUnavailableView("Nog geen evenementen", systemImage: "calendar", description: Text("Kijk later opnieuw of ontdek de gemeentegids.")) }
                ForEach(Array(upcoming.prefix(3))) { event in ListingCard(record: SavedRecord(event: event), select: select) }
                if let date = model.updated { Text("Bijgewerkt \(date.formatted(date: .abbreviated, time: .shortened))").font(.caption).foregroundStyle(.secondary) }
            }.padding(18) }.refreshable { await model.load() }.navigationTitle("Ontdek").modifier(AppToolbar(showInfo: showInfo))
        }
    }
}
struct AgendaView: View {
    @EnvironmentObject var model: AppModel; @Binding var filter: EventFilter
    let showInfo: () -> Void; let select: (SavedRecord) -> Void
    @State private var limit = 20; @State private var expanded = true
    var results: [EventRecord] { filter.apply(model.events) }
    var places: [String] { var seen = Set<String>(); return model.events.compactMap { $0.city }.filter { seen.insert(normalized($0)).inserted }.sorted { $0.localizedStandardCompare($1) == .orderedAscending } }
    var body: some View {
        NavigationStack { ScrollView { LazyVStack(alignment: .leading, spacing: 15) {
            SectionTitle(title: "Agenda")
            DataStatus()
            TextField("Evenement, adres of plaats", text: $filter.query).textFieldStyle(.roundedBorder).submitLabel(.search).accessibilityIdentifier("agendaSearch")
            DisclosureGroup("Zoekfilters", isExpanded: $expanded) { VStack(spacing: 12) {
                Picker("Soort resultaat", selection: $filter.kind) { Text("Alles").tag("all"); Text("Evenementen").tag("events"); Text("Adressen").tag("addresses") }.pickerStyle(.segmented)
                Picker("Categorie", selection: $filter.category) { Text("Alle categorieën").tag(""); ForEach(model.categories) { Text($0.name).tag($0.id) } }
                Picker("Wanneer", selection: $filter.when) { ForEach(DateChoice.allCases) { Text($0.rawValue).tag($0) } }
                Picker("Plaats", selection: $filter.place) { Text("Alle plaatsen").tag(""); ForEach(places, id: \.self) { Text($0).tag($0) } }
                Picker("Afstand vanaf Duras", selection: $filter.radius) { ForEach([10.0, 25.0, 50.0], id: \.self) { Text("Binnen \(Int($0)) km").tag($0) } }
                Picker("Sorteer resultaten", selection: $filter.sort) { ForEach(SortChoice.allCases) { Text($0.rawValue).tag($0) } }
                Toggle("Alleen bevestigde gratis toegang", isOn: $filter.freeOnly)
                Button("Wis alle filters") { filter = EventFilter() }.frame(maxWidth: .infinity, alignment: .leading)
            }.font(.subheadline).padding(.top, 12) }.padding().background(.white).clipShape(RoundedRectangle(cornerRadius: 16))
            if let error = model.categoryError { Text(error).font(.footnote).foregroundStyle(.secondary) }
            if filter.when != .all { Text("Meerjarige bronvermeldingen zonder losse datum staan onder Alle data & adressen.").font(.footnote).foregroundStyle(.secondary) }
            Text("\(results.count) resultaten · uitgelichte advertenties eerst").font(.caption).foregroundStyle(.secondary).accessibilityIdentifier("agendaCount")
            if model.loading { ProgressView("De agenda wordt geladen…") }
            else if results.isEmpty && model.error == nil { ContentUnavailableView.search(text: filter.query) }
            ForEach(Array(results.prefix(limit))) { event in ListingCard(record: SavedRecord(event: event), select: select) }
            if results.count > limit { Button("Toon meer") { limit += 20 }.buttonStyle(.bordered).frame(maxWidth: .infinity) }
        }.padding(18) }.refreshable { await model.load() }.onChange(of: filter) { _, _ in limit = 20 }.navigationTitle("Agenda").modifier(AppToolbar(showInfo: showInfo)) }
    }
}
struct GuideView: View {
    @EnvironmentObject var model: AppModel
    let showInfo: () -> Void; let select: (SavedRecord) -> Void
    @State private var townID = "duras"; @State private var type = "pharmacy"; @State private var query = ""; @State private var limit = 20
    var town: Town? { Town.all.first { $0.id == townID } }
    var filtered: [ServiceRecord] { model.services.filter { query.isEmpty || normalized([$0.name, $0.address ?? "", $0.municipality ?? ""].joined(separator: " ")).contains(normalized(query)) } }
    var body: some View {
        NavigationStack { ScrollView { LazyVStack(alignment: .leading, spacing: 15) {
            SectionTitle(title: "Gemeentegids")
            Text("Praktische adressen per gemeente, met contactgegevens en bronnen waar beschikbaar.").font(.subheadline).foregroundStyle(.secondary)
            VStack(spacing: 12) {
                Picker("Gemeente", selection: $townID) { ForEach(Town.all) { Text($0.name).tag($0.id) } }
                Picker("Categorie", selection: $type) { ForEach(ServiceType.all) { Text($0.name).tag($0.id) } }
                TextField("Naam of adres", text: $query).textFieldStyle(.roundedBorder).accessibilityIdentifier("guideSearch")
            }.padding().background(.white).clipShape(RoundedRectangle(cornerRadius: 16))
            if model.guideLoading { ProgressView("Adressen worden opgehaald…") }
            else if let error = model.guideError { Text(error); Button("Opnieuw proberen") { if let town { Task { await model.loadGuide(town: town, type: type) } } } }
            else {
                if model.guideCached { Text("Bewaarde gegevens. Controleer actuele openingstijden bij de bron.").font(.footnote).foregroundStyle(.secondary) }
                Text("\(filtered.count) resultaten · ook nabijgelegen adressen").font(.caption).foregroundStyle(.secondary)
                ForEach(Array(filtered.prefix(limit))) { service in ListingCard(record: SavedRecord(service: service, context: model.guideContext), select: select) }
                if filtered.isEmpty { ContentUnavailableView.search(text: query) }
                if filtered.count > limit { Button("Toon meer") { limit += 20 }.buttonStyle(.bordered) }
            }
        }.padding(18) }.navigationTitle("Gemeentegids").modifier(AppToolbar(showInfo: showInfo))
            .task(id: townID + ":" + type) { if let town { query = ""; limit = 20; await model.loadGuide(town: town, type: type) } }
            .refreshable { if let town { await model.loadGuide(town: town, type: type) } }
        }
    }
}
struct FavouritesView: View {
    @EnvironmentObject var model: AppModel; @EnvironmentObject var favourites: FavouritesStore
    let showInfo: () -> Void; let select: (SavedRecord) -> Void
    @State private var query = ""; @State private var kind = "all"; @State private var export = false; @State private var importing = false
    @State private var document = BackupDocument(data: Data()); @State private var pending: [SavedRecord]?; @State private var message = ""
    var filtered: [SavedRecord] { favourites.records.map(model.current).filter { (kind == "all" || $0.kind == kind) && (query.isEmpty || normalized([$0.title, $0.place, $0.address].joined(separator: " ")).contains(normalized(query))) } }
    var body: some View {
        NavigationStack { ScrollView { LazyVStack(alignment: .leading, spacing: 15) {
            SectionTitle(title: "Jouw favorieten")
            Picker("Bewaarde soorten", selection: $kind) { Text("Alles").tag("all"); Text("Agenda").tag("event"); Text("Gemeentegids").tag("service") }.pickerStyle(.segmented)
            TextField("Naam, adres of plaats", text: $query).textFieldStyle(.roundedBorder).accessibilityIdentifier("favouriteSearch")
            Text("\(filtered.count) van \(favourites.records.count) favorieten").font(.caption).accessibilityIdentifier("favouriteCount")
            DisclosureGroup("Reservekopie & overzetten") { VStack(alignment: .leading, spacing: 12) {
                Text("Bewaar alle favorieten als bestand. Bij het terugzetten blijven bestaande favorieten behouden.").font(.footnote)
                Button("Bewaar reservekopie") { do { document = BackupDocument(data: try BackupEnvelope.data(favourites.records.map(model.current))); export = true } catch { message = "De reservekopie kon niet worden gemaakt." } }.disabled(favourites.records.isEmpty)
                Button("Lees reservekopie in") { importing = true }
            }.padding(.top, 10) }.padding().background(.white).clipShape(RoundedRectangle(cornerRadius: 16))
            if !message.isEmpty { Text(message).font(.footnote).padding().background(Color.green.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 14)) }
            Text("Je favorieten staan alleen op dit apparaat. Controleer actuele informatie bij de bron.").font(.footnote).foregroundStyle(.secondary)
            ForEach(filtered) { record in ListingCard(record: record, select: select) }
            if filtered.isEmpty { ContentUnavailableView("Bewaar iets moois", systemImage: "heart", description: Text(query.isEmpty ? "Tik op het hartje bij een evenement of adres." : "Probeer een andere zoekterm.")) }
        }.padding(18) }.navigationTitle("Bewaard").modifier(AppToolbar(showInfo: showInfo))
            .fileExporter(isPresented: $export, document: document, contentType: .json, defaultFilename: "Cote-de-Duras-favorieten") { result in if case .failure = result { message = "De reservekopie is niet opgeslagen." } }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                do { let url = try result.get(); let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }; let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0; guard size <= 10 * 1024 * 1024 else { throw BackupError.invalid }; pending = try BackupEnvelope.read(Data(contentsOf: url)) }
                catch { message = "Kies een geldige Cote de Duras-reservekopie. Je bestaande favorieten blijven behouden." }
            }
            .confirmationDialog("Favorieten toevoegen", isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } }), titleVisibility: .visible) {
                Button("Voeg favorieten toe") { let count = favourites.merge(pending ?? []); pending = nil; message = "\(count) favoriet(en) toegevoegd. Bestaande favorieten zijn behouden." }; Button("Annuleren", role: .cancel) { pending = nil }
            } message: { Text("De reservekopie bevat \(pending?.count ?? 0) favoriet(en). Dubbele vermeldingen worden overgeslagen.") }
        }
    }
}
struct ListingPhoto: View {
    let record: SavedRecord
    var body: some View {
        if let url = webURL(record.image, base: AppConfiguration.apiBase) {
            VStack(alignment: .leading, spacing: 5) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().aspectRatio(contentMode: record.service == nil ? .fill : .fit) }
                    else if phase.error != nil { Label("Foto niet beschikbaar", systemImage: "photo").font(.caption).foregroundStyle(.secondary) }
                    else { ProgressView() }
                }.frame(maxWidth: .infinity).frame(height: 180).clipped().background(Color.durasGold.opacity(0.06))
                if let service = record.service {
                    HStack { if let source = webURL(service.image_source_url) { Link("Foto: " + (service.image_credit ?? "bron bekijken"), destination: source) } else if let credit = service.image_credit { Text("Foto: " + credit) }; if let license = service.image_license { Text("· " + license) } }.font(.caption2).foregroundStyle(.secondary).padding(.horizontal, 12)
                }
            }
        }
    }
}
struct ListingCard: View {
    @EnvironmentObject var model: AppModel; @EnvironmentObject var favourites: FavouritesStore
    let record: SavedRecord; let select: (SavedRecord) -> Void
    var highlighted: Bool { record.event?.highlighted() ?? record.service?.highlighted ?? false }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if highlighted { Text("UITGELICHTE ADVERTENTIE").font(.caption).bold().padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Color.durasGreen).foregroundStyle(.white) }
            ListingPhoto(record: record)
            VStack(alignment: .leading, spacing: 10) {
                Text((record.event?.dateLabel ?? ServiceType.name(record.service?.type ?? "")) + " · " + record.place).font(.caption).foregroundStyle(Color.durasGold)
                if let distance = record.event?.distance_km { Text("\(distance, specifier: "%.1f") km van Duras").font(.caption).foregroundStyle(.secondary) }
                Button { select(record) } label: { Text(record.title).font(.system(.title2, design: .serif)).multilineTextAlignment(.leading).foregroundStyle(Color.durasGreen) }.buttonStyle(.plain)
                if let text = record.event?.short_description ?? record.service?.address { Text(text).font(.subheadline).foregroundStyle(.secondary).lineLimit(3) }
                HStack {
                    Button("Bekijk details →") { select(record) }.font(.subheadline)
                    Spacer()
                    Button { favourites.toggle(record) } label: { Image(systemName: favourites.contains(record) ? "heart.fill" : "heart").frame(width: 44, height: 44) }.accessibilityLabel((favourites.contains(record) ? "Verwijder " : "Bewaar ") + record.title).accessibilityIdentifier("favourite-" + (record.event?.id ?? record.service?.id ?? ""))
                }
            }.padding(16)
        }.background(highlighted ? Color(red: 1, green: 0.99, blue: 0.95) : .white).clipShape(RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(highlighted ? Color.durasGreen : Color.gray.opacity(0.18), lineWidth: highlighted ? 3 : 1))
    }
}
struct ListingDetail: View {
    @EnvironmentObject var model: AppModel; @EnvironmentObject var favourites: FavouritesStore; @Environment(\.dismiss) private var dismiss
    let record: SavedRecord; @State private var calendar = false
    var value: SavedRecord { model.current(record) }
    var body: some View {
        NavigationStack { ScrollView { VStack(alignment: .leading, spacing: 17) {
            ListingPhoto(record: value)
            VStack(alignment: .leading, spacing: 16) {
                Text(value.event?.dateLabel ?? ServiceType.name(value.service?.type ?? "")).font(.subheadline).foregroundStyle(Color.durasGold)
                Text(value.title).font(.system(.largeTitle, design: .serif)).foregroundStyle(Color.durasGreen).accessibilityAddTraits(.isHeader)
                if let event = value.event, event.isLongRunning { Text("De bron geeft een lange periode op. Vraag de organisator naar de actuele dagen en tijden.").font(.footnote).padding().background(Color.orange.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 12)) }
                if value.event?.is_free == true { Label("Gratis toegang volgens de bron", systemImage: "checkmark.circle").font(.subheadline) }
                Text([value.address, value.place].filter { !$0.isEmpty }.joined(separator: ", ")).textSelection(.enabled)
                if let event = value.event { Text(event.description ?? event.short_description ?? "").textSelection(.enabled) }
                if let hours = value.service?.openingHours { Text("Openingstijden: " + hours).font(.subheadline) }
                if let event = value.event, event.canAddToCalendar {
                    Button { calendar = true } label: { Label("Bewaar in mijn agenda", systemImage: "calendar.badge.plus").frame(maxWidth: .infinity).padding(8) }.buttonStyle(.bordered)
                    Text("Het iOS-agendavenster opent. Controleer datum, tijd en duur voordat je zelf bewaart.").font(.caption).foregroundStyle(.secondary)
                }
                Button { favourites.toggle(value) } label: { Label(favourites.contains(value) ? "Bewaard · verwijderen" : "Bewaar deze vermelding", systemImage: favourites.contains(value) ? "heart.fill" : "heart").frame(maxWidth: .infinity).padding(8) }.buttonStyle(.borderedProminent)
                if let url = model.shareURL(value) { ShareLink(item: url) { Label("Deel deze vermelding", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity).padding(8) }.buttonStyle(.bordered) }
                if let phone = value.event?.contact_phone ?? value.service?.phone, let url = URL(string: "tel:" + phone.filter { $0.isNumber || $0 == "+" }) { Link(destination: url) { Label("Bel " + phone, systemImage: "phone").frame(maxWidth: .infinity, alignment: .leading).padding(8) } }
                if let email = value.service?.email, email.contains("@"), let url = URL(string: "mailto:" + email) { Link(destination: url) { Label("Stuur een e-mail", systemImage: "envelope").padding(8) } }
                if let url = webURL(value.event?.website_url ?? value.service?.website) { Link("Officiële website ↗", destination: url).padding(8) }
                if let url = webURL(value.event?.booking_url) { Link("Reserveren ↗", destination: url).padding(8) }
                if !value.address.isEmpty || !value.place.isEmpty, let map = mapURL { Link(destination: map) { Label("Route in Apple Kaarten", systemImage: "map").padding(8) } }
                if let url = webURL(value.event?.source_url ?? value.service?.sourceUrl) { Link("Bron bekijken ↗", destination: url).padding(8) }
                Text("Controleer actuele gegevens bij de organisator. Afstanden zijn hemelsbreed vanaf Duras; we vragen geen GPS-locatie op.").font(.caption).foregroundStyle(.secondary)
            }.padding(18)
        } }.background(Color.durasCream).toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Sluiten") { dismiss() } } }
            .sheet(isPresented: $calendar) { if let event = value.event { NativeCalendarEditor(event: event, url: model.shareURL(value)) } }
        }
    }
    var mapURL: URL? { var components = URLComponents(string: "https://maps.apple.com/"); components?.queryItems = [URLQueryItem(name: "q", value: [value.title, value.address, value.place].joined(separator: " "))]; return components?.url }
}
struct AppInformation: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack { List {
            Section { Image("Brand").resizable().scaledToFit().frame(width: 90, height: 90).clipShape(RoundedRectangle(cornerRadius: 20)); Text("Cote de Duras").font(.system(.title, design: .serif)); Text("Agenda en gemeentegids binnen 50 km rond Duras."); Text("Versie 1.0 · testgegevensbron").font(.caption).foregroundStyle(.secondary) }
            Section("Jouw gegevens") { Text("Geen account nodig. Favorieten blijven op je apparaat; reservekopieën deel je alleen op eigen initiatief. De app vraagt geen GPS-locatie of advertentietracking."); Text("Als de gegevensverbinding uitvalt, kunnen eerder geladen openbare gegevens worden getoond. Foto's zijn niet gegarandeerd offline beschikbaar.") }
            Section("Bronnen en actualiteit") { Text("Foto's tonen waar beschikbaar de bron. Controleer openingstijden, prijzen en evenementtijden bij de organisator.") }
            Section("Informatie") { if let base = AppConfiguration.apiBase { Link("Privacy", destination: base.appendingPathComponent("privacy")); Link("Handleiding", destination: base.appendingPathComponent("handleiding")) }; Link("Contact", destination: URL(string: "mailto:Info@cotededuras.com")!) }
        }.navigationTitle("Over deze app").toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Sluiten") { dismiss() } } } }
    }
}
