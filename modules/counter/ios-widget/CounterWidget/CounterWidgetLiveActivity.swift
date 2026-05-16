import ActivityKit
import WidgetKit
import SwiftUI

struct CounterWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var emoji: String
    }

    var name: String
}

struct CounterWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CounterWidgetAttributes.self) { context in
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension CounterWidgetAttributes {
    fileprivate static var preview: CounterWidgetAttributes {
        CounterWidgetAttributes(name: "World")
    }
}

extension CounterWidgetAttributes.ContentState {
    fileprivate static var smiley: CounterWidgetAttributes.ContentState {
        CounterWidgetAttributes.ContentState(emoji: "😀")
    }

    fileprivate static var starEyes: CounterWidgetAttributes.ContentState {
        CounterWidgetAttributes.ContentState(emoji: "🤩")
    }
}

#Preview("Notification", as: .content, using: CounterWidgetAttributes.preview) {
    CounterWidgetLiveActivity()
} contentStates: {
    CounterWidgetAttributes.ContentState.smiley
    CounterWidgetAttributes.ContentState.starEyes
}
