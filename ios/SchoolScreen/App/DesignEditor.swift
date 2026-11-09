import SwiftUI

struct SchoolPalette: Decodable, Identifiable { var id: String; var name: String; var colors: [String: String] }
struct SchoolLayout: Decodable, Identifiable { var name: String; var description: String; var patch: [String: JSONValue]; var id: String { name } }
enum DesignResources {
    static func read<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
    static let palettes = read("Palettes", as: [SchoolPalette].self) ?? []
    static let layouts = read("Layouts", as: [SchoolLayout].self) ?? []
    static let defaults = read("DesignDefaults", as: [String: JSONValue].self) ?? [:]
}
@MainActor @Observable
final class DesignStore {
    let screenID: String
    var document: DesignDocument
    var baseline: [String: JSONValue]
    var busy = false
    var uploading = false
    var error: String?
    var saved = false
    init(screen: SchoolScreen) {
        screenID = screen.id; document = DesignDocument(screen.template); baseline = screen.template
        if screen.mode == "slideshow", screen.template["mediaSlideshow"] == nil { document.setMode("slideshow") }
    }
    var dirty: Bool { document.values != baseline }
    func value(_ path: String) -> JSONValue? {
        if let value = document.value(path) { return value }
        if path == "loopAppearance.meterFill", let accent = document.value("loopAppearance.accent") ?? document.value("accent") { return accent }
        if path == "loopAppearance.meterTrack", let border = document.value("loopAppearance.border") { return border }
        let parts = path.split(separator: ".").map(String.init)
        if parts.first == "loopAppearance", parts.count > 1 { return DesignResources.defaults["appearance"]?.object?[parts[1]] }
        if ["slideshow", "centerSlideshow", "mediaSlideshow"].contains(parts.first ?? ""), parts.count > 1 { return DesignResources.defaults["slideshow"]?.object?[parts[1]] }
        if parts.first == "recognition", parts.count > 1 { return DesignResources.defaults["recognition"]?.object?[parts[1]] }
        return DesignDocument(DesignResources.defaults["template"]?.object ?? [:]).value(path)
    }
    func set(_ value: JSONValue, _ path: String) {
        document.set(value, at: path)
        let sync = ["background": "background", "color": "text", "accent": "accent"]
        if let nested = sync[path] { document.set(value, at: "loopAppearance." + nested) }
        for (top, nested) in sync where path == "loopAppearance." + nested { document.set(value, at: top) }
    }
    func text(_ path: String, _ fallback: String = "") -> Binding<String> {
        Binding(get: { self.value(path)?.text ?? fallback }, set: { self.set(.string($0), path) })
    }
    func flag(_ path: String, _ fallback: Bool = false) -> Binding<Bool> {
        Binding(get: { self.value(path)?.flag ?? fallback }, set: { self.set(.bool($0), path) })
    }
    func number(_ path: String, _ fallback: Double) -> Binding<Double> {
        Binding(get: { self.value(path)?.decimal ?? fallback }, set: { self.set(.number($0), path) })
    }
    func list(_ path: String) -> [JSONValue] { document.value(path)?.list ?? [] }
    func setList(_ list: [JSONValue], _ path: String) { document.set(.array(list), at: path) }
    func save(_ app: AppModel) async {
        guard !busy, !uploading else { return }; busy = true; error = nil
        defer { busy = false }
        let snapshot = document.values
        do {
            try validate()
            if !app.demo { try await app.api?.saveTemplate(screenID: screenID, patch: DesignPatch.difference(from: baseline, to: snapshot)) }
            baseline = snapshot; saved = true; try? await app.loadScreens()
        } catch { self.error = app.readable(error) }
    }
    func validate() throws {
        if document.value("displayMode")?.text == "slideshow", list("mediaSlideshow.images").isEmpty { throw AppError.message("أضف صورًا لعرض الشرائح أولًا.") }
        if document.value("timetableSeason")?.text == "custom" {
            guard let periods = document.value("timetable.periods")?.list, periods.count == 7 else { throw AppError.message("أدخل أوقات الحصص السبع.") }
            var previous = -1
            for period in periods {
                let pair = period.list?.compactMap { $0.text } ?? []
                func minutes(_ text: String) -> Int? {
                    let parts = text.split(separator: ":").compactMap { Int($0) }
                    guard parts.count == 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]) else { return nil }; return parts[0] * 60 + parts[1]
                }
                guard pair.count == 2, let start = minutes(pair[0]), let end = minutes(pair[1]), start >= previous, end > start else { throw AppError.message("تحقق من أوقات الحصص: النهاية بعد البداية، ولا تتداخل الحصص.") }
                previous = end
            }
        }
    }
}
struct DesignEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var editor: DesignStore
    @State private var leave = false
    init(screen: SchoolScreen) { _editor = State(initialValue: DesignStore(screen: screen)) }
    var body: some View {
        Form {
            Section { DesignColorPreview() }
            Section("وضع العرض") {
                Picker("ما الذي يظهر على التلفزيون؟", selection: Binding(get: { editor.value("displayMode")?.text ?? "daily" }, set: { editor.document.setMode($0) })) {
                    Text("المحتوى اليومي").tag("daily"); Text("الخلفية والساعة والحصص").tag("loop")
                    Text("صورة أو فيديو").tag("media"); Text("عرض شرائح بملء الشاشة").tag("slideshow")
                }
            }
            Section("التصميم") {
                NavigationLink { PaletteEditor() } label: { Label("ألوان الشاشة", systemImage: "paintpalette") }
                NavigationLink { WallpaperEditor() } label: { Label("الخلفية والصور والمؤثرات", systemImage: "photo.on.rectangle.angled") }
                NavigationLink { LayoutEditor() } label: { Label("توزيع النص والصور", systemImage: "rectangle.3.group") }
                NavigationLink { IdentityEditor() } label: { Label("هوية المدرسة والتاريخ", systemImage: "graduationcap") }
            }
            Section("خلفية الحصص") {
                NavigationLink { TimetableEditor() } label: { Label("الساعة والجدول الدراسي", systemImage: "clock") }
                NavigationLink { RecognitionEditor() } label: { Label("لوحة التميز والطلاب", systemImage: "star.circle") }
                NavigationLink { PlaylistEditor(path: "centerSlideshow", title: "صور وسط الشاشة") } label: { Label("صور وسط الشاشة", systemImage: "photo.stack") }
                NavigationLink { CenterPhotoEditor() } label: { Label("شكل وحجم صورة الوسط", systemImage: "crop") }
            }
            Section {
                NavigationLink { PlaylistEditor(path: "mediaSlideshow", title: "صور بملء الشاشة") } label: { Label("عرض شرائح بملء الشاشة", systemImage: "rectangle.stack") }
            }
        }.designPage("تصميم الشاشة").environment(editor)
            .navigationBarBackButtonHidden(true)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("رجوع", systemImage: "chevron.right") { if editor.dirty { leave = true } else { dismiss() } }.disabled(editor.busy || editor.uploading) } }
            .confirmationDialog("لديك تغييرات لم تطبّق بعد", isPresented: $leave, titleVisibility: .visible) {
                Button("متابعة التعديل", role: .cancel) {}
                Button("تجاهل التغييرات", role: .destructive) { dismiss() }
            }
    }
}
private struct DesignPage: ViewModifier {
    @Environment(DesignStore.self) private var editor
    @Environment(AppModel.self) private var app
    let title: String
    func body(content: Content) -> some View {
        @Bindable var editor = editor
        content.navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .disabled(editor.busy)
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    if let error = editor.error { Text(error).font(.footnote).foregroundStyle(.red) }
                    PrimaryButton(title: editor.dirty ? "تطبيق التغييرات على الشاشة" : "التصميم محفوظ", icon: "checkmark.circle", busy: editor.busy, disabled: !editor.dirty || editor.uploading) { Task { await editor.save(app) } }
                }.padding().background(.regularMaterial)
            }
            .alert(app.demo ? "تم حفظ التجربة" : "تم تحديث تصميم الشاشة", isPresented: $editor.saved) { Button("حسنًا", role: .cancel) {} }
    }
}
extension View { func designPage(_ title: String) -> some View { modifier(DesignPage(title: title)) } }
struct DesignColorPreview: View {
    @Environment(DesignStore.self) private var editor
    var body: some View {
        VStack(spacing: 14) {
            Text(editor.value("loopSchoolName")?.text ?? editor.value("schoolName")?.text ?? "مدرستنا").font(.headline)
            HStack {
                VStack(spacing: 8) { Text("09:41").font(.title.monospacedDigit()); Text("الحصة الثالثة").font(.caption); ProgressView(value: 0.62).tint(Color(hex: editor.value("loopAppearance.meterFill")?.text ?? "#3e7fe0")) }
                    .padding().background(Color(hex: editor.value("loopAppearance.widget")?.text ?? "#ffffff"), in: RoundedRectangle(cornerRadius: 14))
                Spacer()
                Text("نجوم الأسبوع\nعلمٌ ينفع، وأثرٌ يبقى.").font(.subheadline).multilineTextAlignment(.center)
            }
            Text("معاينة ألوان مبسّطة · يتحدث التلفزيون بعد التطبيق").font(.caption)
        }.padding(18).foregroundStyle(Color(hex: editor.value("color")?.text ?? "#254d80"))
            .background(Color(hex: editor.value("background")?.text ?? "#f2f6ff"), in: RoundedRectangle(cornerRadius: 18))
    }
}
struct PaletteEditor: View {
    @Environment(DesignStore.self) private var editor
    var body: some View {
        Form {
            Section { DesignColorPreview() }
            Section("٣١ لوحة مشتركة مع تصميم المحتوى اليومي") {
                ForEach(DesignResources.palettes) { palette in
                    Button { editor.document.applyPalette(palette.colors) } label: {
                        HStack {
                            ForEach(["background", "widget", "text", "accent"], id: \.self) { key in Circle().fill(Color(hex: palette.colors[key] ?? "#ffffff")).frame(width: 24, height: 24).overlay(Circle().stroke(.gray.opacity(0.25))) }
                            Text(palette.name).foregroundStyle(.primary); Spacer()
                            if editor.value("background")?.text == palette.colors["background"] { Image(systemName: "checkmark.circle.fill") }
                        }.padding(.vertical, 5)
                    }
                }
            }
            Section("ألوان مخصصة") {
                DesignColorField(label: "الخلفية", path: "background"); DesignColorField(label: "النص", path: "color"); DesignColorField(label: "اللون البارز", path: "accent")
                ForEach(Array(colorLabels.enumerated()), id: \.offset) { _, item in DesignColorField(label: item.1, path: "loopAppearance." + item.0) }
            }
        }.designPage("ألوان الشاشة")
    }
    private let colorLabels = [("widget", "البطاقات"), ("muted", "النص الثانوي"), ("border", "حدود البطاقات"), ("meterFill", "تعبئة مؤشر الحصة"), ("meterTrack", "مسار مؤشر الحصة"), ("line1", "الخط الأول"), ("line2", "الخط الثاني"), ("line3", "الخط الثالث"), ("cube1", "المكعب الأول"), ("cube2", "المكعب الثاني"), ("cube3", "المكعب الثالث")]
}
struct DesignColorField: View {
    @Environment(DesignStore.self) private var editor
    let label: String
    let path: String
    var body: some View {
        ColorPicker(label, selection: Binding(get: { Color(hex: editor.value(path)?.text ?? "#ffffff") }, set: { color in
            let c = UIColor(color); var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            if c.getRed(&r, green: &g, blue: &b, alpha: &a) { editor.set(.string(String(format: "#%02x%02x%02x", Int((r * 255).rounded()), Int((g * 255).rounded()), Int((b * 255).rounded()))), path) }
        }), supportsOpacity: false)
    }
}
struct DesignRange: View {
    @Environment(DesignStore.self) private var editor
    let label: String; let path: String; let range: ClosedRange<Double>; let fallback: Double
    var step: Double = 1
    var body: some View {
        VStack(alignment: .leading) {
            HStack { Text(label); Spacer(); Text(editor.number(path, fallback).wrappedValue, format: .number.precision(.fractionLength(step < 1 ? 1 : 0))).foregroundStyle(.secondary).monospacedDigit() }
            Slider(value: editor.number(path, fallback), in: range, step: step).accessibilityLabel(label)
        }.padding(.vertical, 5)
    }
}
struct WallpaperEditor: View {
    @Environment(DesignStore.self) private var editor
    var body: some View {
        Form {
            Section("صورة خلفية ثابتة") { PhotoUploadRow(title: "اختيار صورة الخلفية", url: editor.text("backgroundImage"), onBusy: { editor.uploading = $0 }) }
            Section {
                NavigationLink { PlaylistEditor(path: "slideshow", title: "شرائح الخلفية") } label: { Label("شرائح خلفية متحركة", systemImage: "photo.stack") }
                InfoNote(text: "الخلفية تظهر خلف المحتوى اليومي وخلفية الحصص. الصور بملء الشاشة لها قائمة مستقلة.")
            }
        }.designPage("الخلفية والصور")
    }
}
struct IdentityEditor: View {
    @Environment(DesignStore.self) private var editor
    var body: some View {
        Form {
            Section("هوية المحتوى اليومي") {
                TextField("اسم المدرسة", text: editor.text("schoolName")); TextField("العبارة التعريفية", text: editor.text("schoolTagline"))
                PhotoUploadRow(title: "رفع شعار المدرسة", url: editor.text("schoolLogo"), onBusy: { editor.uploading = $0 })
                DesignRange(label: "حجم الهوية", path: "schoolScale", range: 60...180, fallback: 100)
                DesignRange(label: "الموضع الأفقي", path: "schoolX", range: 0...90, fallback: 55)
                DesignRange(label: "الموضع الرأسي", path: "schoolY", range: 0...82, fallback: 6)
                DesignRange(label: "عرض الهوية", path: "schoolW", range: 20...75, fallback: 39)
            }
            Section("هوية خلفية الحصص") {
                TextField("اسم المدرسة في الخلفية", text: editor.text("loopSchoolName"))
                Picker("الشعارات", selection: editor.text("loopBranding", "paired")) { Text("وزارة التعليم وأكاديمية طويق").tag("paired"); Text("شعار المدرسة").tag("school") }
            }
            Section("التاريخ والخط") {
                Picker("التاريخ المعروض", selection: editor.text("calendar", "gregory")) { Text("ميلادي").tag("gregory"); Text("هجري").tag("islamic"); Text("كلاهما").tag("both") }
                Picker("الخط", selection: editor.text("font", "Cairo")) { Text("كايرو").tag("Cairo"); Text("خط المدرسة").tag("SchoolArabic"); Text("النظام").tag("sans-serif") }
            }
        }.designPage("هوية المدرسة")
    }
}
struct LayoutEditor: View {
    @Environment(DesignStore.self) private var editor
    var body: some View {
        Form {
            Section("توزيعات جاهزة · تحافظ على ألوانك") {
                ForEach(DesignResources.layouts) { layout in
                    Button { for (key, value) in layout.patch { editor.set(value, key) } } label: {
                        VStack(alignment: .leading, spacing: 5) { Text(layout.name); Text(layout.description).font(.caption).foregroundStyle(.secondary) }.padding(.vertical, 5)
                    }
                }
            }
            Section("النص") {
                DesignRange(label: "حجم الخط", path: "fontSize", range: 60...140, fallback: 100)
                DesignRange(label: "الموضع الأفقي", path: "textX", range: 0...90, fallback: 49)
                DesignRange(label: "الموضع الرأسي", path: "textY", range: 0...80, fallback: 30)
                DesignRange(label: "عرض النص", path: "textW", range: 10...95, fallback: 45)
                DesignRange(label: "المسافة بين النصوص", path: "spacing", range: 0.3...3, fallback: 1, step: 0.1)
                Picker("المحاذاة", selection: editor.text("align", "right")) { Text("يمين").tag("right"); Text("وسط").tag("center"); Text("يسار").tag("left") }
            }
            Section("الصورة") {
                DesignRange(label: "الموضع الأفقي", path: "imageX", range: 0...90, fallback: 6)
                DesignRange(label: "الموضع الرأسي", path: "imageY", range: 0...90, fallback: 21)
                DesignRange(label: "العرض", path: "imageW", range: 0...95, fallback: 38)
                DesignRange(label: "الارتفاع", path: "imageH", range: 0...95, fallback: 64)
                DesignRange(label: "استدارة الزوايا", path: "radius", range: 0...80, fallback: 18)
                Picker("ملاءمة الصورة", selection: editor.text("fit", "cover")) { Text("تغطية").tag("cover"); Text("احتواء").tag("contain"); Text("تمدد").tag("fill") }
            }
        }.designPage("توزيع العناصر")
    }
}
struct CenterPhotoEditor: View {
    @Environment(DesignStore.self) private var editor
    var body: some View {
        Form {
            Picker("الشكل", selection: editor.text("centerPhoto.shape", "rounded")) { Text("مستطيل ناعم").tag("rounded"); Text("مستطيل").tag("rectangle"); Text("دائرة").tag("circle"); Text("بيضاوي").tag("oval") }
            Picker("النسبة", selection: editor.text("centerPhoto.ratio", "16:9")) { ForEach(["16:9", "4:3", "3:2", "1:1", "9:16"], id: \.self) { Text($0).tag($0) } }
            DesignRange(label: "عرض صورة الوسط", path: "centerPhoto.width", range: 18...60, fallback: 34)
            InfoNote(text: "يتكيف العرض مع المساحة المتاحة بين الساعة ولوحة التميز.")
        }.designPage("صورة الوسط")
    }
}
