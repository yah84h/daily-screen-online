import SwiftUI

@main
struct SchoolScreenApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar_SA"))
                .tint(Brand.blue)
                .task { await model.restore() }
                .onChange(of: phase) { _, value in
                    if value == .active && model.staff != nil { Task { await model.refresh() } }
                }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        @Bindable var model = model
        Group {
            if model.loading && model.staff == nil {
                VStack(spacing: 20) { BrandMark(); ProgressView("جارٍ تجهيز شاشاتك…") }
                    .frame(maxWidth: .infinity, maxHeight: .infinity).background(Brand.background)
            } else if model.localOnly && !model.demo && (model.configuration == nil || model.showServerSetup) { ServerConnectionView() }
            else if model.staff != nil { ScreensView() }
            else { LoginView() }
        }
        .alert("تعذر إكمال العملية", isPresented: Binding(get: { model.error != nil }, set: { if !$0 { model.error = nil } })) {
            Button("حسنًا", role: .cancel) { model.error = nil }
        } message: { Text(model.error ?? "") }
    }
}
