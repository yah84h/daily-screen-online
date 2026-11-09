import SwiftUI

struct NewsEditor: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let screen: SchoolScreen
    @State private var settings: [String: JSONValue]
    @State private var notices: [Notice]
    @State private var busy = false
    @State private var saved = false
    @State private var dirty = false
    @State private var confirmLeave = false
    @State private var error: String?

    init(screen: SchoolScreen) {
        self.screen = screen
        let settings = screen.template["news"]?.object ?? [
            "enabled": .bool(true), "apiEnabled": .bool(true), "speed": .number(20),
            "quotesEnabled": .bool(true), "opacity": .number(56), "translateArabic": .bool(true)
        ]
        _settings = State(initialValue: settings)
        if case .array(let list) = settings["items"] {
            _notices = State(initialValue: list.compactMap { $0.object.map(Notice.init) })
        } else { _notices = State(initialValue: []) }
    }
    var body: some View {
        Form {
            Section {
                Toggle("إظهار شريط الأخبار", isOn: Binding(get: {
                    if case .bool(let enabled) = settings["enabled"] { return enabled }; return true
                }, set: { settings["enabled"] = .bool($0); dirty = true }))
                Toggle("الأسئلة التعليمية المدمجة", isOn: Binding(get: { settings["quotesEnabled"]?.flag ?? true }, set: { settings["quotesEnabled"] = .bool($0); dirty = true }))
                VStack(alignment: .leading) {
                    Text("مدة عرض الخبر · \(Int(settings["speed"]?.decimal ?? 20)) ثانية")
                    Slider(value: Binding(get: { settings["speed"]?.decimal ?? 20 }, set: { settings["speed"] = .number($0); dirty = true }), in: 12...90, step: 1)
                }
                VStack(alignment: .leading) {
                    Text("وضوح خلفية الشريط · \(Int(settings["opacity"]?.decimal ?? 56))٪")
                    Slider(value: Binding(get: { settings["opacity"]?.decimal ?? 56 }, set: { settings["opacity"] = .number($0); dirty = true }), in: 35...85, step: 1)
                }
                if model.localOnly { InfoNote(text: "أخبار الناشرين والترجمة عبر الإنترنت معطلة في النسخة المحلية.", icon: "wifi.slash") }
                InfoNote(text: "تظهر هذه الإعلانات ضمن شريط أخبار خلفية الحصص. لا تغيّر هذه الصفحة وضع الشاشة.")
                if screen.mode != "loop" { InfoNote(text: "الشاشة ليست في وضع خلفية الحصص حاليًا. تظهر الأخبار عند تفعيل هذا الوضع من الإدارة.", icon: "tv") }
            }
            ForEach($notices) { $notice in
                Section {
                    TextField("نص الإعلان", text: $notice.text, axis: .vertical).lineLimit(3...6)
                        .onChange(of: notice.text) { _, value in
                            if value.count > 300 { notice.text = String(value.prefix(300)) }
                        }
                    Text("\(notice.text.count) / ٣٠٠").font(.caption).foregroundStyle(.secondary)
                    TextField("اسم المعلم (اختياري)", text: $notice.teacher)
                    Picker("السنة الدراسية", selection: $notice.year) {
                        Text("جميع الصفوف").tag(""); Text("الأول الثانوي").tag("first"); Text("الثاني الثانوي").tag("second"); Text("الثالث الثانوي").tag("third")
                    }
                    Toggle("وقت انتهاء للإعلان", isOn: $notice.expires)
                    if notice.expires { DatePicker("ينتهي في", selection: $notice.expiry).environment(\.timeZone, TimeZone(identifier: "Asia/Riyadh")!) }
                    Toggle("إظهار هذا الإعلان", isOn: $notice.enabled)
                    Button("حذف الإعلان", role: .destructive) { notices.removeAll { $0.id == notice.id } }
                } header: { Text("إعلان مدرسي") }
            }
            Section {
                Button { notices.append(Notice(values: [:])) } label: {
                    Label("إضافة إعلان", systemImage: "plus.circle.fill").frame(minHeight: 44)
                }.disabled(notices.count >= 30)
            }
            if let error { Section { Text(error).foregroundStyle(.red) } }
            Section {
                PrimaryButton(title: "نشر أخبار المدرسة", icon: "paperplane.fill", busy: busy,
                              disabled: notices.contains { $0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
                    Task { await save() }
                }
            }
        }.navigationTitle("أخبار المدرسة").navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("رجوع", systemImage: "chevron.right") {
                if dirty { confirmLeave = true } else { dismiss() }
            }.disabled(busy) } }
            .disabled(busy)
            .onChange(of: notices) { _, _ in dirty = true }
            .alert(model.demo ? "اكتملت التجربة" : "تم نشر الأخبار", isPresented: $saved) { Button("حسنًا") {} }
            .confirmationDialog("لديك تعديلات لم تنشر بعد", isPresented: $confirmLeave, titleVisibility: .visible) {
                Button("تجاهل التعديلات", role: .destructive) { dismiss() }
                Button("متابعة التعديل", role: .cancel) {}
            }
    }
    private func save() async {
        guard !busy else { return }
        busy = true; error = nil
        defer { busy = false }
        var updated = settings
        updated["items"] = .array(notices.map { .object($0.json) })
        do {
            if !model.demo { try await model.api?.saveNews(screenID: screen.id, settings: updated) }
            settings = updated; dirty = false; saved = true
            try? await model.loadScreens()
        } catch { self.error = model.readable(error) }
    }
}
private struct Notice: Identifiable, Equatable {
    let id: String
    var values: [String: JSONValue]
    var text: String
    var teacher: String
    var enabled: Bool
    var year: String
    var expires: Bool
    var expiry: Date
    init(values: [String: JSONValue]) {
        self.values = values; id = values["id"]?.text ?? UUID().uuidString
        text = values["text"]?.text ?? ""; teacher = values["teacher"]?.text ?? ""
        year = values["year"]?.text ?? ""
        let date = values["expiresAt"]?.text.flatMap(SchoolTime.parseISO)
        expires = date != nil; expiry = date ?? Date().addingTimeInterval(86400)
        if case .bool(let flag) = values["enabled"] { enabled = flag } else { enabled = true }
    }
    var json: [String: JSONValue] {
        var result = values
        result["id"] = .string(id); result["text"] = .string(text.trimmingCharacters(in: .whitespacesAndNewlines))
        result["teacher"] = .string(String(teacher.prefix(80))); result["enabled"] = .bool(enabled)
        if year.isEmpty { result.removeValue(forKey: "year") } else { result["year"] = .string(year) }
        if expires { result["expiresAt"] = .string(ISO8601DateFormatter().string(from: expiry)) } else { result.removeValue(forKey: "expiresAt") }
        return result
    }
}
