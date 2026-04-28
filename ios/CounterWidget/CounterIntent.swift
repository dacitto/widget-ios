//
//  CounterIntent.swift
//  widgetios
//
//  Created by Salah Eddine Daci on 28/4/2026.
//

import AppIntents
import WidgetKit

func writeCountToSharedFile(_ count: Int) {
    guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.widgetios.counter"
    ) else {
        return
    }

    let fileURL = containerURL.appendingPathComponent("count.txt")

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
