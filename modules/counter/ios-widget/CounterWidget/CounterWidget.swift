import WidgetKit
import SwiftUI
import AppIntents

func readCountFromSharedFile() -> Int {
    guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: SharedConfig.appGroupIdentifier
    ) else {
        return 0
    }

    let fileURL = containerURL.appendingPathComponent(SharedConfig.countFileName)

    guard let content = try? String(contentsOf: fileURL, encoding: .utf8),
          let count = Int(content.trimmingCharacters(in: .whitespacesAndNewlines)) else {
        return 0
    }

    return count
}

func persistWidgetConfiguration(_ configuration: ConfigurationAppIntent) {
    guard let defaults = UserDefaults(suiteName: SharedConfig.appGroupIdentifier) else {
        return
    }

    defaults.set(configuration.showResetButton, forKey: SharedConfig.showResetButtonKey)
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), count: 0, showResetButton: false)
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
        persistWidgetConfiguration(configuration)
        return SimpleEntry(
            date: Date(),
            count: readCountFromSharedFile(),
            showResetButton: configuration.showResetButton
        )
    }

    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
        persistWidgetConfiguration(configuration)
        let entry = SimpleEntry(
            date: Date(),
            count: readCountFromSharedFile(),
            showResetButton: configuration.showResetButton
        )
        return Timeline(entries: [entry], policy: .never)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let count: Int
    let showResetButton: Bool
}

struct CounterWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(spacing: 12) {
            Text("\(entry.count)")
                .font(.largeTitle)

            HStack(spacing: 12) {
                Button(intent: DecrementCounterIntent()) {
                    Text("-")
                        .font(.title)
                }
                .buttonStyle(.plain)

                Button(intent: IncrementCounterIntent()) {
                    Text("+")
                        .font(.title)
                }
                .buttonStyle(.plain)

                if entry.showResetButton {
                    Button(intent: ResetCounterIntent()) {
                        Text("Reset")
                            .font(.caption)
                            .fontWeight(.semibold)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct CounterWidget: Widget {
    let kind: String = "CounterWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: ConfigurationAppIntent.self,
            provider: Provider()
        ) { entry in
            CounterWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .supportedFamilies([
            .systemSmall,
            .accessoryCircular,
            .accessoryRectangular
        ])
    }
}
