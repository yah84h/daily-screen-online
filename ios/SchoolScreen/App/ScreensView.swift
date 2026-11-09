import SwiftUI

struct ScreensView: View {
    @Environment(AppModel.self) private var model
    @State private var pairing = false
    @State private var settings = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if model.demo {
                        Label("وضع تجريبي · لن تُحفظ أو تُنشر أي تغييرات", systemImage: "sparkles")
                            .font(.subheadline.bold()).padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("أهلًا، \(model.staff?.username ?? "")").font(.title2.bold())
                        Text("اختر شاشة، وأضف شيئًا يستحق المشاهدة.")
                            .foregroundStyle(.secondary)
                    }
                    if let message = model.message {
                        Label(message, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green).padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
                    }
                    ForEach(model.screens) { screen in
                        NavigationLink { ScreenDetailView(screen: screen) } label: {
                            HStack(spacing: 16) {
                                Image(systemName: "tv").font(.title2).foregroundStyle(Brand.blue)
                                    .frame(width: 58, height: 58).background(Brand.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
                                VStack(alignment: .leading, spacing: 7) {
                                    Text(screen.name).font(.headline).foregroundStyle(.primary)
                                    Text(modeName(screen.mode)).font(.subheadline).foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.left").font(.footnote.bold()).foregroundStyle(.tertiary)
                            }.padding(20).background(.background, in: RoundedRectangle(cornerRadius: 22))
                        }.buttonStyle(.plain)
                    }
                    if model.screens.isEmpty {
                        EmptyState(title: "لا توجد شاشات بعد", detail: "أضف شاشة من إعدادات الموقع، ثم اسحب هنا للتحديث.", icon: "tv")
                    } else if model.staff?.canPair == true {
                        PrimaryButton(title: "ربط تلفزيون", icon: "link") { pairing = true }
                        InfoNote(text: "افتح رابط المدرسة على التلفزيون، ثم أدخل الرمز الذي يظهر عليه.")
                    }
                }.padding(20).frame(maxWidth: 680).frame(maxWidth: .infinity)
            }.background(Brand.background).navigationTitle("شاشاتي")
                .refreshable { await model.refresh() }
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("الإعدادات", systemImage: "gearshape") { settings = true } } }
                .sheet(isPresented: $pairing) { PairingView() }
                .sheet(isPresented: $settings) { SettingsView() }
        }
    }
}

func modeName(_ mode: String) -> String {
    switch mode {
    case "loop": return "خلفية الحصص"
    case "media": return "صور وفيديو"
    case "slideshow": return "عرض شرائح"
    default: return "المحتوى اليومي"
    }
}

struct ScreenDetailView: View {
    @Environment(AppModel.self) private var model
    let screen: SchoolScreen
    @State private var post: ScreenPost?
    @State private var devices: [ScreenDevice] = []
    @State private var loading = true
    @State private var loadError: String?
    @State private var pairing = false
    @State private var unpairCode: String?
    @State private var confirmUnpair = false
    var currentScreen: SchoolScreen { model.screens.first { $0.id == screen.id } ?? screen }
    var body: some View {
        List {
            Section {
                Label(modeName(currentScreen.mode), systemImage: "rectangle.on.rectangle")
                if loading { ProgressView("جارٍ تحديث الحالة…") }
                else if let loadError {
                    InfoNote(text: loadError, icon: "wifi.exclamationmark")
                    Button("إعادة المحاولة") { Task { await load() } }
                } else if model.demo { Label("معاينة تجريبية", systemImage: "sparkles") }
                else {
                    Label(devices.contains { $0.isOnline() } ? "يوجد تلفزيون متصل" : "لا يوجد تلفزيون متصل الآن",
                          systemImage: devices.contains { $0.isOnline() } ? "checkmark.circle.fill" : "tv.slash")
                        .foregroundStyle(devices.contains { $0.isOnline() } ? .green : .secondary)
                    Text("الحالة حسب آخر اتصال؛ اسحب للتحديث.").font(.caption).foregroundStyle(.secondary)
                }
            } header: { Text("حالة الشاشة") }
            if model.staff?.canPair == true {
                Section {
                    NavigationLink { DesignEditor(screen: currentScreen) } label: { ActionRow(title: "تصميم الشاشة والخلفية", detail: "الألوان والصور والحصص ولوحة التميز", icon: "paintpalette") }
                }
            }
            if model.staff?.canPublish == true {
                Section {
                    NavigationLink {
                        AnnouncementEditor(screen: currentScreen, initial: Announcement(values: currentScreen.draft ?? post?.content ?? [:]), mediaOnly: false)
                    } label: { ActionRow(title: "تعديل الإعلان اليومي", detail: "عنوان ورسالة وصورة", icon: "square.and.pencil") }
                    NavigationLink {
                        AnnouncementEditor(screen: currentScreen, initial: Announcement(values: currentScreen.draft ?? post?.content ?? [:]), mediaOnly: true)
                    } label: { ActionRow(title: "عرض صورة أو فيديو", detail: "وسائط تملأ الشاشة", icon: "photo.on.rectangle") }
                } header: { Text("ماذا تريد أن تعرض؟") }
                    .disabled(loading || loadError != nil)
            }
            if model.staff?.canNews == true {
                Section {
                    NavigationLink { NewsEditor(screen: currentScreen) } label: {
                        ActionRow(title: "أخبار المدرسة", detail: "إعلانات قصيرة في شريط الأخبار", icon: "newspaper")
                    }
                }
            }
            if model.localOnly && model.staff?.canPublish == true {
                Section("مكتبة المحتوى") {
                    NavigationLink { ContentLibrary(screen: currentScreen, kind: "presets") } label: { Label("المواضيع المحفوظة", systemImage: "bookmark") }
                    NavigationLink { ContentLibrary(screen: currentScreen, kind: "schedule") } label: { Label("الجدولة", systemImage: "calendar") }
                    NavigationLink { ContentLibrary(screen: currentScreen, kind: "history") } label: { Label("سجل النشر", systemImage: "clock.arrow.circlepath") }
                }
            }
            if let post {
                Section("آخر محتوى منشور") {
                    Text(post.content["title"]?.text ?? "وسائط الشاشة").font(.headline)
                    Text(post.publish_at).font(.caption).foregroundStyle(.secondary)
                }
            }
            if model.staff?.canPair == true {
                Section {
                    Button { pairing = true } label: { Label("ربط تلفزيون بهذه الشاشة", systemImage: "link") }
                        .frame(minHeight: 44)
                    ForEach(devices) { device in
                        LabeledContent(device.label ?? "تلفزيون") {
                            Text(device.isOnline() ? "متصل" : "غير متصل").foregroundStyle(.secondary)
                        }.swipeActions { if model.localOnly { Button("إلغاء الربط", role: .destructive) { unpairCode = device.code; confirmUnpair = true } } }
                    }
                }
            }
        }.navigationTitle(screen.name).navigationBarTitleDisplayMode(.inline)
            .task { await load() }
            .refreshable { await model.refresh(); await load() }
            .confirmationDialog("إلغاء ربط هذا التلفزيون؟", isPresented: $confirmUnpair, titleVisibility: .visible) {
                Button("إلغاء الربط", role: .destructive) { Task {
                    guard let code = unpairCode else { return }
                    do { try await model.api?.localMutate(table: "screen_devices", action: "delete", filters: [localFilter("code", code), localFilter("screen_id", screen.id)]); await load() }
                    catch { loadError = model.readable(error) }
                } }
            }
            .sheet(isPresented: $pairing, onDismiss: { Task { await load() } }) { PairingView(initialScreenID: screen.id) }
    }
    private func load() async {
        guard !model.demo, let api = model.api else { loading = false; return }
        loading = true; loadError = nil
        defer { loading = false }
        do {
            async let p = api.latestPost(screenID: screen.id)
            async let d = api.devices(screenID: screen.id)
            (post, devices) = try await (p, d)
        } catch { loadError = model.readable(error) }
    }
}
struct ActionRow: View {
    let title: String
    let detail: String
    let icon: String
    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }.padding(.vertical, 10)
        } icon: { Image(systemName: icon).foregroundStyle(Brand.blue) }
    }
}
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var confirmSignOut = false
    var body: some View {
        NavigationStack {
            List {
                if model.localOnly {
                    Section("إدارة النسخة المحلية") {
                        NavigationLink("تغيير كلمة المرور") { OwnPasswordEditor() }
                        if model.staff?.canPair == true {
                            NavigationLink("إدارة الشاشات") { ScreenManagement() }
                            NavigationLink("الحسابات والصلاحيات") { AccountManagement() }
                            NavigationLink("هوية المدرسة العامة") { SchoolSettingsEditor() }
                            NavigationLink("تنظيف الصور والفيديو غير المستخدم") { MediaCleanupView() }
                        }
                    }
                }
                Section("الحساب") {
                    LabeledContent("اسم المستخدم", value: model.staff?.username ?? "")
                    LabeledContent("الصلاحية", value: model.staff?.canPair == true ? "مسؤول المدرسة" : "معلم")
                }
                Section {
                    if model.localOnly {
                        LabeledContent("الخادم المحلي", value: model.configuration?.siteURL.absoluteString ?? "")
                        Button("تغيير عنوان الخادم") { dismiss(); model.showServerSetup = true }
                    }
                    if let site = model.configuration?.siteURL {
                        Link(destination: site.appendingPathComponent("admin")) { Label(model.localOnly ? "فتح لوحة التحكم في المتصفح" : "الإعدادات المتقدمة في الموقع", systemImage: "safari") }
                    }
                    InfoNote(text: model.localOnly ? "يمكنك أيضًا إدارة الخادم المحلي من متصفح الماك أو الهاتف." : "القوالب والجدول والحسابات متاحة في موقع المدرسة.")
                }
                Section {
                    Button(model.demo ? "إنهاء الجولة التجريبية" : "تسجيل الخروج", role: .destructive) { confirmSignOut = true }
                }
            }.navigationTitle("الإعدادات").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("تم") { dismiss() } } }
                .confirmationDialog("تسجيل الخروج؟", isPresented: $confirmSignOut, titleVisibility: .visible) {
                    Button("تسجيل الخروج", role: .destructive) { dismiss(); Task { await model.signOut() } }
                }
        }
    }
}
