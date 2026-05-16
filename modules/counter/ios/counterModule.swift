import ExpoModulesCore
import WidgetKit

public class counterModule: Module {
    private let appGroupIdentifier = "group.com.widgetios.counter"
    private let countFileName = "count.txt"
    private let showResetButtonKey = "counterWidget.showResetButton"

    public func definition() -> ModuleDefinition {
        Name("counter")

        Function("getCount") { () -> Int in
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupIdentifier
            ) else {
                return 0
            }

            let fileURL = containerURL.appendingPathComponent(self.countFileName)

            guard let content = try? String(contentsOf: fileURL, encoding: .utf8),
                  let count = Int(content.trimmingCharacters(in: .whitespacesAndNewlines)) else {
                return 0
            }

            return count
        }

        Function("setCount") { (count: Int) in
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupIdentifier
            ) else {
                return
            }

            let fileURL = containerURL.appendingPathComponent(self.countFileName)

            try? "\(count)".write(
                to: fileURL,
                atomically: true,
                encoding: .utf8
            )
            
            WidgetCenter.shared.reloadAllTimelines()
        }

        Function("getShowResetButton") { () -> Bool in
            guard let defaults = UserDefaults(suiteName: self.appGroupIdentifier) else {
                return false
            }

            return defaults.bool(forKey: self.showResetButtonKey)
        }
    }
}
