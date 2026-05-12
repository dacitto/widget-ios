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

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), count: 0)
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
        SimpleEntry(date: Date(), count: readCountFromSharedFile())
    }

    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
        let entry = SimpleEntry(date: Date(), count: readCountFromSharedFile())
        return Timeline(entries: [entry], policy: .never)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let count: Int
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
