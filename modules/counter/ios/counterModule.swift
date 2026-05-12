import ExpoModulesCore
import WidgetKit

public class counterModule: Module {
    public func definition() -> ModuleDefinition {
        Name("counter")

        Function("getCount") { () -> Int in
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: "group.com.widgetios.counter"
            ) else {
                return 0
            }

            let fileURL = containerURL.appendingPathComponent("count.txt")

            guard let content = try? String(contentsOf: fileURL, encoding: .utf8),
                  let count = Int(content.trimmingCharacters(in: .whitespacesAndNewlines)) else {
                return 0
            }

            return count
        }

        Function("setCount") { (count: Int) in
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
    }
}
