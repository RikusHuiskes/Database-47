import SwiftUI
import EventKit
import EventKitUI

struct NativeCalendarEditor: UIViewControllerRepresentable {
    let event: EventRecord; let url: URL?; @Environment(\.dismiss) private var dismiss
    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let parent: NativeCalendarEditor; let store = EKEventStore()
        init(_ parent: NativeCalendarEditor) { self.parent = parent }
        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) { parent.dismiss() }
    }
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let controller = EKEventEditViewController(); controller.eventStore = context.coordinator.store; controller.editViewDelegate = context.coordinator
        let item = EKEvent(eventStore: context.coordinator.store); item.title = event.title; item.location = [event.address, event.city].compactMap { $0 }.joined(separator: ", "); item.url = url
        let sourceStart = FrenchDates.instant(event.start_at), sourceEnd = event.end_at.flatMap(FrenchDates.instant)
        if let sourceStart, let sourceEnd, sourceEnd > sourceStart, !event.start_at.contains("T00:00:00") {
            item.startDate = sourceStart; item.endDate = sourceEnd; item.isAllDay = false
        } else {
            let day = FrenchDates.day(event.start_at) ?? FrenchDates.dayString(AppClock.now); let pieces = day.split(separator: "-").compactMap { Int($0) }
            var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
            let start = calendar.date(from: DateComponents(year: pieces[0], month: pieces[1], day: pieces[2])) ?? AppClock.now
            item.startDate = start; item.endDate = calendar.date(byAdding: .day, value: 1, to: start); item.isAllDay = true
        }
        item.notes = [event.short_description, "Controleer de precieze datum, tijd en duur bij de organisator voordat je bewaart."].compactMap { $0 }.joined(separator: "\n\n")
        controller.event = item; return controller
    }
    func updateUIViewController(_ controller: EKEventEditViewController, context: Context) {}
}
