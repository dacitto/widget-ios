//
//  CounterWidgetBundle.swift
//  CounterWidget
//
//  Created by Salah Eddine Daci on 28/4/2026.
//

import WidgetKit
import SwiftUI

@main
struct CounterWidgetBundle: WidgetBundle {
    var body: some Widget {
        CounterWidget()
        CounterWidgetControl()
        CounterWidgetLiveActivity()
    }
}
