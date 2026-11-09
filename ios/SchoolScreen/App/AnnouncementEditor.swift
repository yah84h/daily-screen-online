import SwiftUI
import PhotosUI
import AVKit

struct AnnouncementEditor: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let screen: SchoolScreen
    let mediaOnly: Bool
    @State private var content: Announcement
    @State private var baseline: Announcement
    @State private var selection: PhotosPickerItem?
    @State private var busy = false
    @State private var upload = MediaUploadController()
    @State private var auxiliaryBusy: Set<String> = []
    private var uploading: Bool { upload.busy || !auxiliaryBusy.isEmpty }
    @State private var preview = false
    @State private var confirmLeave = false
    @State private var requestID = UUID()
    @State private var error: String?
    @State private var showSaved = false
    @State private var schedule = false
    @State private var preset = false

    init(screen: SchoolScreen, initial: Announcement, mediaOnly: Bool) {
        self.screen = screen; self.mediaOnly = mediaOnly
        _content = State(initialValue: initial); _baseline = State(initialValue: initial)
    }
    private var desiredMode: String { mediaOnly ? "media" : "daily" }
    private var allowed: Bool { model.staff?.permissions.admin == true || screen.mode == desiredMode }
    private var valid: Bool { mediaOnly ? !content["fullMedia"].isEmpty : !content["title"].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    var body: some View {
        Form {
            if model.demo { Section { InfoNote(text: "جولة تجريبية · لن يتم النشر على تلفزيون حقيقي.", icon: "sparkles") } }
            if !allowed { Section { InfoNote(text: "وضع الشاشة الحالي: \(modeName(screen.mode)). اطلب من المسؤول تغييره إلى \(modeName(desiredMode)) قبل النشر.", icon: "lock") } }
            if !mediaOnly {
                Section("رسالتك اليوم") {
                    TextField("عنوان الإعلان", text: text("title"), axis: .vertical).font(.headline)
                    TextField("عبارة قصيرة (اختياري)", text: text("subtitle"), axis: .vertical)
                    TextField("اكتب تفاصيل الإعلان…", text: text("body"), axis: .vertical).lineLimit(5...12)
                }
            }
            Section(mediaOnly ? "الصورة أو الفيديو" : "صورة الإعلان") {
                if upload.busy { UploadProgressCard(upload: upload) }
                else {
                    let url = content[mediaOnly ? "fullMedia" : "image"]
                    if !url.isEmpty {
                        if mediaOnly && content["fullType"] == "video" {
                            Label("الفيديو جاهز للمعاينة", systemImage: "video.fill").foregroundStyle(Brand.blue)
                        } else {
                            AsyncImage(url: URL(string: url)) { image in image.resizable().scaledToFit() }
                            placeholder: { ProgressView().frame(height: 120) }
                                .frame(maxHeight: 220).clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        Button("إزالة الوسائط", role: .destructive) {
                            content[mediaOnly ? "fullMedia" : "image"] = ""
                        }
                    }
                    PhotosPicker(selection: $selection, matching: mediaOnly ? .any(of: [.images, .videos]) : .images,
                                 preferredItemEncoding: .compatible) {
                        Label(url.isEmpty ? "اختيار من الصور" : "تغيير الوسائط", systemImage: "photo.badge.plus")
                            .frame(minHeight: 44)
                    }
                    if mediaOnly { InfoNote(text: "قد يستغرق رفع الفيديو بعض الوقت. أبقِ التطبيق مفتوحًا حتى يكتمل.") }
                }
            }
            if !mediaOnly { extras }
            if mediaOnly {
                Section("خيارات العرض") {
                    Picker("ملاءمة الصورة أو الفيديو", selection: text("mediaFit", default: "cover")) {
                        Text("عرض كامل دون قص").tag("contain")
                        Text("ملء الشاشة مع القص").tag("cover")
                        Text("تمدد").tag("fill")
                    }
                    if content["fullType"] == "video" {
                        Toggle("تشغيل الصوت", isOn: flag("videoSound", default: true))
                        Toggle("تكرار الفيديو", isOn: flag("videoLoop", default: true))
                        Toggle("إظهار أزرار تشغيل الفيديو", isOn: flag("videoControls", default: false))
                        InfoNote(text: "قد يحتاج التلفزيون إلى ضغطة للسماح بالصوت.")
                    }
                }
            }
            if model.localOnly {
                Section("حفظ واستخدام لاحق") {
                    Button { schedule = true } label: { Label("جدولة المحتوى", systemImage: "calendar.badge.plus") }.disabled(!valid || uploading)
                    Button { preset = true } label: { Label("حفظ كموضوع جاهز", systemImage: "bookmark") }.disabled(uploading)
                }
            }
            if let uploadError = upload.error { Section { Text(uploadError).foregroundStyle(.red) } }
            if let error { Section { Text(error).foregroundStyle(.red).textSelection(.enabled) } }
            Section {
                PrimaryButton(title: "معاينة قبل النشر", icon: "eye", disabled: !valid || !allowed || uploading) { preview = true }
                Button { Task { await saveDraft() } } label: { Label("حفظ مسودة لوقت لاحق", systemImage: "square.and.arrow.down").frame(minHeight: 44) }.disabled(uploading)
            } footer: { Text("النشر يحدّث كل تلفزيون مربوط بهذه الشاشة. تبقى إعدادات التصميم الأخرى محفوظة.") }
        }.navigationTitle(mediaOnly ? "صور وفيديو" : "الإعلان اليومي").navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("رجوع", systemImage: "chevron.right") {
                if content != baseline { confirmLeave = true } else { dismiss() }
            }.disabled(busy || uploading) } }
            .disabled(busy)
            .overlay { if busy { ProgressView("جارٍ الحفظ…").padding(24).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18)) } }
            .onChange(of: selection) { _, item in if let item { upload.start(item, model: model, preserveAnimation: mediaOnly) { media in
                    content[mediaOnly ? "fullMedia" : "image"] = media.url.absoluteString
                    if mediaOnly { content["fullType"] = media.isVideo ? "video" : "image" }
                }; selection = nil } }
            .onChange(of: content) { _, _ in requestID = UUID() }
            .sheet(isPresented: $preview) {
                PublishPreview(screen: screen, content: content, mediaOnly: mediaOnly, requestID: requestID) {
                    baseline = content; dismiss()
                }
            }
            .sheet(isPresented: $schedule) { ScheduleContentSheet(screenID: screen.id, content: content) }
            .sheet(isPresented: $preset) { NavigationStack { PresetEditor(initial: content) } }
            .confirmationDialog("لديك تعديلات لم تحفظ بعد", isPresented: $confirmLeave, titleVisibility: .visible) {
                Button("حفظ مسودة والعودة") { Task { await saveDraft(leave: true) } }
                Button("تجاهل التعديلات", role: .destructive) { dismiss() }
                Button("متابعة التعديل", role: .cancel) {}
            }
            .alert("تم حفظ المسودة", isPresented: $showSaved) { Button("حسنًا", role: .cancel) {} }
            .onDisappear { upload.cancel() }
    }
    private var extras: some View {
        Section("العناصر الإضافية") {
            DisclosureGroup("الشارة والتذييل والتاريخ") {
                Toggle("إظهار العبارة القصيرة", isOn: flag("showSubtitle", default: true))
                Toggle("إظهار الشارة", isOn: flag("showBadge", default: true))
                TextField("نص الشارة", text: text("badge"))
                Toggle("إظهار التذييل", isOn: flag("showFooter", default: true))
                TextField("نص التذييل", text: text("footer"))
                Toggle("تاريخ اليوم تلقائيًا", isOn: flag("autoDate", default: true))
                if content.values["autoDate"]?.flag == false {
                    DatePicker("التاريخ", selection: Binding(get: { ISO8601DateFormatter().date(from: content["date"] + "T12:00:00+03:00") ?? Date() }, set: { content["date"] = SchoolTime.today($0) }), displayedComponents: .date).environment(\.timeZone, TimeZone(identifier: "Asia/Riyadh")!)
                }
            }
            DisclosureGroup("الصورة الثانوية ورمز QR والشعار") {
                Toggle("إظهار الصورة الثانوية", isOn: flag("showSecondary", default: false))
                PhotoUploadRow(title: "الصورة الثانوية", url: text("secondary"), onBusy: { value in if value { auxiliaryBusy.insert("secondary") } else { auxiliaryBusy.remove("secondary") } })
                Toggle("إظهار رمز QR", isOn: flag("showQR", default: false))
                PhotoUploadRow(title: "صورة رمز QR", url: text("qr"), onBusy: { value in if value { auxiliaryBusy.insert("qr") } else { auxiliaryBusy.remove("qr") } })
                PhotoUploadRow(title: "شعار خاص بهذا الإعلان", url: text("logo"), onBusy: { value in if value { auxiliaryBusy.insert("logo") } else { auxiliaryBusy.remove("logo") } })
            }
        }
    }
    private func text(_ key: String, default fallback: String = "") -> Binding<String> {
        Binding(get: { content[key].isEmpty ? fallback : content[key] }, set: { content[key] = $0 })
    }
    private func flag(_ key: String, default fallback: Bool) -> Binding<Bool> {
        Binding(get: { if case .bool(let v) = content.values[key] { return v }; return fallback },
                set: { content.values[key] = .bool($0) })
    }
    private func saveDraft(leave: Bool = false) async {
        guard !busy else { return }
        busy = true; error = nil
        defer { busy = false }
        do {
            if !model.demo { try await model.api?.saveDraft(screenID: screen.id, announcement: content) }
            baseline = content
            if leave { dismiss() } else { showSaved = true }
        } catch { self.error = model.readable(error) }
    }

}

struct PublishPreview: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let screen: SchoolScreen
    let content: Announcement
    let mediaOnly: Bool
    let requestID: UUID
    let onPublished: () -> Void
    @State private var publishing = false
    @State private var published = false
    @State private var error: String?
    @State private var player: AVPlayer?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if published {
                        VStack(spacing: 16) {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 64)).foregroundStyle(.green)
                            Text(model.demo ? "اكتملت التجربة" : "تم النشر").font(.largeTitle.bold())
                            Text(model.demo ? "لم يتم تغيير أي شاشة حقيقية." : "سيصل المحتوى إلى التلفزيون خلال ثوانٍ.")
                                .foregroundStyle(.secondary).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity).padding(.vertical, 32)
                        PrimaryButton(title: "العودة للشاشة", icon: "checkmark") { dismiss(); onPublished() }
                    } else {
                        Text(screen.name).font(.title2.bold())
                        if mediaOnly && content["fullType"] == "video" {
                            VideoPlayer(player: player).aspectRatio(16 / 9, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 18))
                        } else {
                            AnnouncementCard(content: content, screen: screen, mediaOnly: mediaOnly)
                        }
                        InfoNote(text: "هذه معاينة مبسّطة للمحتوى. يحافظ التلفزيون على تصميمه وخطوطه ومواضع عناصره المحفوظة.", icon: "eye")
                        if let error {
                            Text(error).foregroundStyle(.red)
                            InfoNote(text: "إذا انقطع الاتصال أثناء النشر، اضغط المحاولة مرة أخرى هنا. لن يُنشأ منشور مكرر لنفس الطلب.")
                        }
                        PrimaryButton(title: error == nil ? (model.demo ? "تجربة النشر" : "نشر على الشاشة") : "المحاولة مرة أخرى",
                                      icon: "paperplane.fill", busy: publishing) { Task { await publish() } }
                        Text("سيستبدل هذا محتوى العرض الحالي على التلفزيونات المربوطة بـ«\(screen.name)».")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }.padding(24)
            }.background(Brand.background).navigationTitle("قبل النشر").navigationBarTitleDisplayMode(.inline)
                .interactiveDismissDisabled(publishing || published)
                .sensoryFeedback(.success, trigger: published)
                .toolbar { if !published { ToolbarItem(placement: .cancellationAction) { Button("تعديل") { dismiss() }.disabled(publishing) } } }
                .onAppear {
                    if mediaOnly && content["fullType"] == "video", let url = URL(string: content["fullMedia"]) {
                        player = AVPlayer(url: url); player?.isMuted = true
                    }
                }.onDisappear { player?.pause(); player = nil }
        }
    }
    private func publish() async {
        guard !publishing else { return }
        publishing = true; error = nil
        defer { publishing = false }
        do {
            if !model.demo {
                guard let api = model.api else { return }
                _ = try await api.publish(screenID: screen.id, announcement: content, mode: mediaOnly ? "media" : "daily", requestID: requestID)
            }
            published = true
            model.message = model.demo ? "اكتملت تجربة النشر بدون تغيير المدرسة." : "تم نشر المحتوى على \(screen.name)."
            try? await model.loadScreens()
        } catch { self.error = model.readable(error) }
    }
}
struct AnnouncementCard: View {
    let content: Announcement
    let screen: SchoolScreen
    let mediaOnly: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if !mediaOnly {
                Label(screen.name, systemImage: "graduationcap").font(.subheadline)
                Text(content["title"]).font(.title.bold())
                if !content["subtitle"].isEmpty { Text(content["subtitle"]).font(.headline) }
                Text(content["body"]).font(.body)
            }
            let image = content[mediaOnly ? "fullMedia" : "image"]
            if !image.isEmpty {
                AsyncImage(url: URL(string: image)) { photo in photo.resizable().scaledToFit() }
                placeholder: { ProgressView().frame(height: 140) }
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
            .foregroundStyle(Color(hex: screen.template["color"]?.text ?? "#254d80"))
            .background(Color(hex: screen.template["background"]?.text ?? "#f2f6ff"), in: RoundedRectangle(cornerRadius: 22))
    }
}
