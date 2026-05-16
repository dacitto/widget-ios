import WidgetKit
import AppIntents

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Counter Settings" }
    static var description: IntentDescription { "Configure counter widget behavior." }

    @Parameter(title: "Show Reset Button")
    var showResetButton: Bool

    init() {
        self.showResetButton = false
    }
}
