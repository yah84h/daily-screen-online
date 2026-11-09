import SwiftUI

struct PairingView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var initialScreenID: String?
    @State private var screenID = ""
    @State private var code = ""
    @State private var label = ""
    @State private var busy = false
    @State private var error: String?
    @State private var success = false
    @FocusState private var codeFocused: Bool
    var body: some View {
        NavigationStack {
            Form {
                if success {
                    Section {
                        VStack(spacing: 16) {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 64)).foregroundStyle(.green)
                            Text("تم ربط التلفزيون").font(.title2.bold())
                            Text("سيظهر محتوى الشاشة خلال ثوانٍ.").foregroundStyle(.secondary)
                            PrimaryButton(title: "العودة إلى شاشاتي", icon: "checkmark") { dismiss() }
                        }.frame(maxWidth: .infinity).padding(.vertical, 24)
                    }
                } else {
                    Section {
                        Label("١. افتح شاشة الربط على التلفزيون", systemImage: "tv")
                        if let site = model.configuration?.siteURL {
                            Text(site.appendingPathComponent("tv").absoluteString + (model.localOnly ? "?pair=1" : ""))
                                .font(.footnote.monospaced()).textSelection(.enabled)
                                .environment(\.layoutDirection, .leftToRight)
                        }
                        Text("٢. أدخل الرمز الظاهر على التلفزيون هنا.")
                    }
                    Section("اختر الشاشة") {
                        Picker("المحتوى الذي سيعرضه التلفزيون", selection: $screenID) {
                            ForEach(model.screens) { Text($0.name).tag($0.id) }
                        }
                        TextField("اسم التلفزيون (اختياري)", text: $label)
                    }
                    Section("رمز الربط") {
                        TextField("000000", text: $code)
                            .keyboardType(.numberPad).textContentType(.oneTimeCode)
                            .font(.largeTitle.monospacedDigit()).multilineTextAlignment(.center)
                            .environment(\.layoutDirection, .leftToRight).focused($codeFocused)
                            .onChange(of: code) { _, value in code = String(value.prefix(6)) }
                            .accessibilityLabel("رمز الربط المكوّن من ستة أرقام")
                        InfoNote(text: "الرمز صالح لمدة ساعة. إذا انتهى، أعد تحميل صفحة التلفزيون.")
                    }
                    if let error { Section { Text(error).foregroundStyle(.red).accessibilityAddTraits(.isStaticText) } }
                    Section {
                        PrimaryButton(title: "ربط التلفزيون", icon: "link", busy: busy,
                                      disabled: SchoolTime.pairingCode(code) == nil || screenID.isEmpty) { Task { await pair() } }
                            .listRowBackground(Color.clear)
                    }
                }
            }.navigationTitle("ربط تلفزيون").navigationBarTitleDisplayMode(.inline)
                .disabled(busy).interactiveDismissDisabled(busy)
                .sensoryFeedback(.success, trigger: success)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() }.disabled(busy) } }
                .onAppear { screenID = initialScreenID ?? model.screens.first?.id ?? "" }
        }
    }
    private func pair() async {
        guard !busy else { return }
        busy = true; error = nil; codeFocused = false
        defer { busy = false }
        if model.demo { success = true; return }
        guard let api = model.api else { return }
        do { try await api.pair(code: code, screenID: screenID, label: label.trimmingCharacters(in: .whitespaces)); success = true }
        catch { self.error = model.readable(error) }
    }
}
