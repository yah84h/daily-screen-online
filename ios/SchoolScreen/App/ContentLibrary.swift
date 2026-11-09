import SwiftUI

func localFilter(_ key: String, _ value: String, operation: String = "eq") -> JSONValue { .array([.string(key), .string(operation), .string(value)]) }

struct ContentLibrary: View {
    @Environment(AppModel.self) private var app
    let screen: SchoolScreen
    let kind: String
    @State private var rows: [JSONValue] = []
    @State private var error: String?
    @State private var loading = false
    @State private var deleting: String?
    @State private var confirmDelete = false
    @State private var addPreset = false
    private var title: String { kind == "presets" ? "المواضيع المحفوظة" : kind == "schedule" ? "الجدولة" : "سجل النشر" }
    private var table: String { kind == "presets" ? "presets" : "posts" }
    var body: some View {
        List {
            if loading { ProgressView("جارٍ التحميل…") }
            if let error { Text(error).foregroundStyle(.red) }
            if !loading && rows.isEmpty { InfoNote(text: "لا يوجد محتوى هنا بعد.") }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                let object = row.object ?? [:]
                NavigationLink {
                    if kind == "presets" { PresetEditor(existing: row) }
                    else { AnnouncementEditor(screen: screen, initial: Announcement(values: object["content"]?.object ?? [:]), mediaOnly: screen.mode == "media") }
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(kind == "presets" ? object["name"]?.text ?? "موضوع محفوظ" : object["content"]?.object?["title"]?.text ?? "وسائط الشاشة").font(.headline)
                        if let date = object["publish_at"]?.text { Text(date).font(.caption.monospacedDigit()).foregroundStyle(.secondary) }
                        if kind != "presets" { Text("افتح لاستخدام المحتوى وتعديله").font(.caption).foregroundStyle(.secondary) }
                    }.padding(.vertical, 6)
                }
                .swipeActions { Button("حذف", role: .destructive) { deleting = object["id"]?.text; confirmDelete = true } }
                if kind == "presets" {
                    NavigationLink("استخدام الموضوع") { AnnouncementEditor(screen: screen, initial: Announcement(values: object["content"]?.object ?? [:]), mediaOnly: screen.mode == "media") }.font(.subheadline)
                }
            }
        }.navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .task { await load() }.refreshable { await load() }
            .toolbar { if kind == "presets" { Button("إضافة موضوع", systemImage: "plus") { addPreset = true } } }
            .sheet(isPresented: $addPreset, onDismiss: { Task { await load() } }) { NavigationStack { PresetEditor() } }
            .confirmationDialog("حذف هذا المحتوى؟", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("حذف", role: .destructive) { Task { await remove() } }
            }
    }
    private func load() async {
        guard !app.demo, let api = app.api else { return }; loading = true; error = nil
        defer { loading = false }
        do {
            let filters: [JSONValue] = kind == "presets" ? [] : [localFilter("screen_id", screen.id), localFilter("publish_at", SchoolTime.today(), operation: kind == "schedule" ? "gt" : "lte")]
            rows = try await api.localRecords(table: table, filters: filters, orders: [.array([.string(kind == "presets" ? "name" : "publish_at"), .bool(kind != "history")])])
        } catch { self.error = app.readable(error) }
    }
    private func remove() async {
        guard let id = deleting else { return }
        do { try await app.api?.localMutate(table: table, action: "delete", filters: [localFilter("id", id)]); await load() }
        catch { self.error = app.readable(error) }
    }
}
struct PresetEditor: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    var existing: JSONValue?
    var initial: Announcement?
    @State private var name = ""
    @State private var content = Announcement()
    @State private var busy = false
    @State private var uploading = false
    @State private var error: String?
    @State private var loaded = false
    var body: some View {
        Form {
            TextField("اسم الموضوع المحفوظ", text: $name)
            TextField("العنوان", text: text("title"), axis: .vertical)
            TextField("العبارة", text: text("subtitle"), axis: .vertical)
            TextField("نص الموضوع", text: text("body"), axis: .vertical).lineLimit(4...10)
            PhotoUploadRow(title: "صورة الموضوع", url: text("image"), onBusy: { uploading = $0 })
            if let error { Text(error).foregroundStyle(.red) }
            PrimaryButton(title: "حفظ الموضوع", icon: "bookmark", busy: busy, disabled: name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || uploading) { Task { await save() } }
        }.navigationTitle("موضوع محفوظ").navigationBarTitleDisplayMode(.inline).disabled(busy)
            .task { guard !loaded else { return }; loaded = true; name = existing?.object?["name"]?.text ?? ""; content = initial ?? Announcement(values: existing?.object?["content"]?.object ?? [:]) }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() }.disabled(busy || uploading) } }
            .interactiveDismissDisabled(busy || uploading)
    }
    private func text(_ key: String) -> Binding<String> { Binding(get: { content[key] }, set: { content[key] = $0 }) }
    private func save() async {
        busy = true; error = nil; defer { busy = false }
        do {
            let id = existing?.object?["id"]?.text
            if !app.demo { try await app.api?.localMutate(table: "presets", action: id == nil ? "insert" : "update", values: ["name": .string(name.trimmingCharacters(in: .whitespacesAndNewlines)), "content": .object(content.values)], filters: id.map { [localFilter("id", $0)] } ?? []) }
            dismiss()
        } catch { self.error = app.readable(error) }
    }
}
struct ScheduleContentSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let screenID: String
    let content: Announcement
    @State private var date = Date()
    @State private var requestID = UUID()
    @State private var busy = false
    @State private var error: String?
    @State private var done = false
    var body: some View {
        NavigationStack {
            Form {
                DatePicker("تاريخ العرض", selection: $date, in: Date()..., displayedComponents: .date).environment(\.timeZone, TimeZone(identifier: "Asia/Riyadh")!)
                InfoNote(text: "النشر حسب تاريخ جدة. يظهر أحدث منشور مستحق دون مؤقت على الخادم. وضع الشاشة وتصميمها مستقلان عن الجدولة.")
                if let error { Text(error).foregroundStyle(.red) }
                PrimaryButton(title: "جدولة المحتوى", icon: "calendar.badge.plus", busy: busy) { Task { await save() } }
            }.navigationTitle("جدولة المحتوى").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() }.disabled(busy) } }
                .interactiveDismissDisabled(busy)
                .onChange(of: date) { _, _ in requestID = UUID() }
                .alert("تمت الجدولة", isPresented: $done) { Button("حسنًا") { dismiss() } }
        }
    }
    private func save() async {
        busy = true; error = nil; defer { busy = false }
        do { if !app.demo { _ = try await app.api?.scheduleLocal(screenID: screenID, content: content, date: SchoolTime.today(date), requestID: requestID) }; done = true }
        catch { self.error = app.readable(error) }
    }
}
