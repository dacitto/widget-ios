import AppIntents
import WidgetKit

func writeCountToSharedFile(_ count: Int) {
    guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: SharedConfig.appGroupIdentifier
    ) else {
        return
    }

    let fileURL = containerURL.appendingPathComponent(SharedConfig.countFileName)

    try? "\(count)".write(
        to: fileURL,
        atomically: true,
        encoding: .utf8
    )

    WidgetCenter.shared.reloadAllTimelines()
}

struct IncrementCounterIntent: AppIntent {
    static var title: LocalizedStringResource = "Increment Counter"

    func perform() async throws -> some IntentResult {
        let current = readCountFromSharedFile()
        writeCountToSharedFile(current + 1)
        return .result()
    }
}

struct DecrementCounterIntent: AppIntent {
    static var title: LocalizedStringResource = "Decrement Counter"

    func perform() async throws -> some IntentResult {
        let current = readCountFromSharedFile()
        writeCountToSharedFile(max(0, current - 1))
        return .result()
    }
}
