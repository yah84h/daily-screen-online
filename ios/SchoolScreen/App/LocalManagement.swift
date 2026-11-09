import SwiftUI

struct ScreenManagement: View {
    @Environment(AppModel.self) private var app
    @State private var name = ""
    @State private var editing: SchoolScreen?
    @State private var editSheet = false
    @State private var deleteID: String?
    @State private var confirmDelete = false
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            ForEach(app.screens) { screen in
                Button { editing = screen; name = screen.name; editSheet = true } label: { Label(screen.name, systemImage: "tv").foregroundStyle(.primary) }
                    .swipeActions { Button("حذف", role: .destructive) { deleteID = screen.id; confirmDelete = true }.disabled(app.screens.count <= 1) }
            }
            Button { editing = nil; name = ""; editSheet = true } label: { Label("إضافة شاشة", systemImage: "plus.circle") }
        }.navigationTitle("إدارة الشاشات").navigationBarTitleDisplayMode(.inline).disabled(busy)
            .sheet(isPresented: $editSheet) {
                NavigationStack { Form {
                    TextField("اسم الشاشة", text: $name)
                    if let error { Text(error).foregroundStyle(.red) }
                    PrimaryButton(title: "حفظ الشاشة", icon: "checkmark", busy: busy, disabled: name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) { Task { await save() } }
                }.navigationTitle(editing == nil ? "شاشة جديدة" : "اسم الشاشة")
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { editSheet = false }.disabled(busy) } }
                    .interactiveDismissDisabled(busy)
                }
            }
            .confirmationDialog("حذف الشاشة ومحتواها وأجهزتها المربوطة؟", isPresented: $confirmDelete, titleVisibility: .visible) { Button("حذف الشاشة", role: .destructive) { Task { await remove() } } }
    }
    private func save() async {
        busy = true; error = nil; defer { busy = false }
        do {
            if !app.demo {
                if let editing { try await app.api?.localMutate(table: "screens", action: "update", values: ["name": .string(String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80)))], filters: [localFilter("id", editing.id)]) }
                else { try await app.api?.localMutate(table: "screens", action: "insert", values: ["name": .string(String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))), "template": DesignResources.defaults["template"] ?? .object([:])]) }
                try await app.loadScreens()
            }
            editSheet = false
        } catch { self.error = app.readable(error) }
    }
    private func remove() async {
        guard let deleteID, app.screens.count > 1 else { return }; busy = true; error = nil; defer { busy = false }
        do { if !app.demo { try await app.api?.localMutate(table: "screens", action: "delete", filters: [localFilter("id", deleteID)]); try await app.loadScreens() } }
        catch { self.error = app.readable(error) }
    }
}
struct AccountManagement: View {
    @Environment(AppModel.self) private var app
    @State private var users: [JSONValue] = []
    @State private var error: String?
    @State private var add = false
    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            ForEach(Array(users.enumerated()), id: \.offset) { _, user in
                NavigationLink { AccountEditor(existing: user) } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(user.object?["username"]?.text ?? "حساب").font(.headline)
                        Text(user.object?["active"]?.flag == false ? "موقوف" : user.object?["permissions"]?.object?["admin"]?.flag == true ? "مسؤول كامل" : "حساب معلم").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            Button { add = true } label: { Label("إضافة حساب", systemImage: "person.badge.plus") }
        }.navigationTitle("الحسابات والصلاحيات").navigationBarTitleDisplayMode(.inline)
            .task { await load() }.refreshable { await load() }
            .sheet(isPresented: $add, onDismiss: { Task { await load() } }) { NavigationStack { AccountEditor() } }
    }
    private func load() async {
        guard !app.demo else { return }
        do { users = try await app.api?.manageLocalStaff(["action": .string("list")]).list ?? []; error = nil }
        catch { self.error = app.readable(error) }
    }
}
struct AccountEditor: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    var existing: JSONValue?
    @State private var username = ""
    @State private var password = ""
    @State private var admin = false
    @State private var news = true
    @State private var daily = false
    @State private var active = true
    @State private var busy = false
    @State private var error: String?
    @State private var loaded = false
    private var owner: Bool { existing?.object?["owner"]?.flag == true }
    var body: some View {
        Form {
            Section("الحساب") {
                TextField("اسم المستخدم", text: $username).textInputAutocapitalization(.never).autocorrectionDisabled().disabled(existing != nil)
                SecureField(existing == nil ? "كلمة المرور · ٨ أحرف على الأقل" : "كلمة مرور جديدة · اتركها فارغة للإبقاء عليها", text: $password).textContentType(.newPassword)
                Toggle("الحساب نشط", isOn: $active).disabled(owner)
            }
            Section("الصلاحيات") {
                Toggle("مسؤول كامل", isOn: $admin).disabled(owner)
                Toggle("تعديل الأخبار", isOn: $news).disabled(admin)
                Toggle("تعديل المحتوى اليومي", isOn: $daily).disabled(admin)
                InfoNote(text: "المسؤول الكامل يملك جميع الصلاحيات. لا يمكن تعطيل الحساب الرئيسي أو آخر مسؤول.")
            }
            if let error { Text(error).foregroundStyle(.red) }
            PrimaryButton(title: existing == nil ? "إنشاء الحساب" : "حفظ الصلاحيات", icon: "person.crop.circle.badge.checkmark", busy: busy,
                          disabled: username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (!admin && !news && !daily) || (existing == nil && password.count < 8) || (!password.isEmpty && password.count < 8)) { Task { await save() } }
        }.navigationTitle(existing == nil ? "حساب جديد" : "تعديل الحساب").navigationBarTitleDisplayMode(.inline).disabled(busy)
            .task {
                guard !loaded else { return }; loaded = true
                if let row = existing?.object { username = row["username"]?.text ?? ""; active = row["active"]?.flag ?? true; let p = row["permissions"]?.object ?? [:]; admin = p["admin"]?.flag ?? false; news = p["news"]?.flag ?? false; daily = p["daily"]?.flag ?? false }
            }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() }.disabled(busy) } }
            .interactiveDismissDisabled(busy)
    }
    private func save() async {
        busy = true; error = nil; defer { busy = false }
        do {
            var input: [String: JSONValue] = ["action": .string(existing == nil ? "create" : "update"), "username": .string(username.trimmingCharacters(in: .whitespacesAndNewlines)), "active": .bool(active), "permissions": .object(["admin": .bool(admin), "news": .bool(admin || news), "daily": .bool(admin || daily)])]
            if let id = existing?.object?["id"] { input["id"] = id }
            if !password.isEmpty { input["password"] = .string(password) }
            if !app.demo { _ = try await app.api?.manageLocalStaff(input) }
            password = ""; dismiss()
        } catch { self.error = app.readable(error) }
    }
}
struct OwnPasswordEditor: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var current = ""
    @State private var password = ""
    @State private var confirm = ""
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        Form {
            SecureField("كلمة المرور الحالية", text: $current).textContentType(.password)
            SecureField("كلمة المرور الجديدة", text: $password).textContentType(.newPassword)
            SecureField("تأكيد كلمة المرور الجديدة", text: $confirm).textContentType(.newPassword)
            if let error { Text(error).foregroundStyle(.red) }
            PrimaryButton(title: "تغيير كلمة المرور", icon: "lock.rotation", busy: busy, disabled: current.isEmpty || password.count < 8 || password != confirm) {
                Task {
                    busy = true; error = nil; defer { busy = false }
                    do { if !app.demo { try await app.api?.changeLocalPassword(current: current, new: password) }; current = ""; password = ""; confirm = ""; dismiss() }
                    catch { self.error = app.readable(error) }
                }
            }
        }.navigationTitle("كلمة المرور").navigationBarTitleDisplayMode(.inline).disabled(busy)
    }
}
struct SchoolSettingsEditor: View {
    @Environment(AppModel.self) private var app
    @State private var name = ""
    @State private var tagline = ""
    @State private var logo = ""
    @State private var uploading = false
    @State private var busy = false
    @State private var error: String?
    @State private var saved = false
    @State private var loaded = false
    var body: some View {
        Form {
            TextField("اسم المدرسة", text: $name); TextField("العبارة التعريفية", text: $tagline)
            PhotoUploadRow(title: "رفع شعار المدرسة العام", url: $logo, onBusy: { uploading = $0 })
            InfoNote(text: "هذه الهوية العامة. الأسماء والشعارات المخصصة داخل تصميم كل شاشة تبقى مستقلة.")
            if let error { Text(error).foregroundStyle(.red) }
            PrimaryButton(title: "حفظ هوية المدرسة", icon: "graduationcap", busy: busy, disabled: uploading || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) { Task { await save() } }
        }.navigationTitle("إعدادات المدرسة").navigationBarTitleDisplayMode(.inline).disabled(busy)
            .task {
                guard !loaded else { return }; loaded = true
                guard !app.demo else { return }
                do { let rows = try await app.api?.localRecords(table: "school_settings") ?? []; if let first = rows.first?.object { name = first["name"]?.text ?? ""; tagline = first["tagline"]?.text ?? ""; logo = first["logo_url"]?.text ?? "" } }
                catch { self.error = app.readable(error) }
            }
            .alert("تم حفظ هوية المدرسة", isPresented: $saved) { Button("حسنًا", role: .cancel) {} }
    }
    private func save() async {
        busy = true; error = nil; defer { busy = false }
        do { if !app.demo { try await app.api?.localMutate(table: "school_settings", action: "update", values: ["name": .string(name), "tagline": .string(tagline), "logo_url": logo.isEmpty ? .null : .string(logo)], filters: [localFilter("id", "1")]) }; saved = true }
        catch { self.error = app.readable(error) }
    }
}
struct MediaCleanupView: View {
    @Environment(AppModel.self) private var app
    @State private var result: [String: JSONValue]?
    @State private var busy = false
    @State private var confirm = false
    @State private var error: String?
    var body: some View {
        Form {
            InfoNote(text: "يفحص الخادم صور وفيديوهات المنشورات والمسودات والقوالب والمواضيع والشعارات. يُحذف فقط ما لا يشير إليه أي محتوى محفوظ.")
            if let result {
                LabeledContent("ملفات غير مستخدمة", value: String(Int(result["count"]?.decimal ?? 0)))
                LabeledContent("الحجم", value: ByteCountFormatter.string(fromByteCount: Int64(result["bytes"]?.decimal ?? 0), countStyle: .file))
                if let removed = result["removed"]?.decimal, removed > 0 { Text("حُذفت \(Int(removed)) ملفات.").foregroundStyle(.green) }
                if let failed = result["failed"]?.decimal, failed > 0 { Text("تعذر حذف \(Int(failed)) ملفات.").foregroundStyle(.orange) }
            }
            if let error { Text(error).foregroundStyle(.red) }
            PrimaryButton(title: "فحص الملفات غير المستخدمة", icon: "internaldrive", busy: busy) { Task { await check(false) } }
            if (result?["count"]?.decimal ?? 0) > 0, (result?["removed"]?.decimal ?? 0) == 0 {
                Button("حذف الملفات غير المستخدمة", role: .destructive) { confirm = true }.disabled(busy)
            }
        }.navigationTitle("تنظيف الوسائط").navigationBarTitleDisplayMode(.inline)
            .confirmationDialog("حذف الملفات غير المستخدمة نهائيًا؟", isPresented: $confirm, titleVisibility: .visible) { Button("حذف", role: .destructive) { Task { await check(true) } } }
    }
    private func check(_ remove: Bool) async {
        busy = true; error = nil; defer { busy = false }
        do { if !app.demo { result = try await app.api?.cleanupLocalMedia(remove: remove).object } else { result = ["count": .number(0), "bytes": .number(0)] } }
        catch { self.error = app.readable(error) }
    }
}
