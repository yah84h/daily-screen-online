import SwiftUI
import PhotosUI

struct PlaylistEditor: View {
    @Environment(DesignStore.self) private var editor
    @Environment(AppModel.self) private var app
    let path: String
    let title: String
    @State private var selection: [PhotosPickerItem] = []
    @State private var upload = MediaUploadController()
    private var images: [JSONValue] { editor.list(path + ".images") }
    private func key(_ name: String) -> String { path + "." + name }
    var body: some View {
        Form {
            Section {
                if path != "mediaSlideshow" { Toggle("تفعيل العرض", isOn: editor.flag(key("enabled"))) }
                if path == "mediaSlideshow" {
                    Button("اختيار عرض الشرائح بملء الشاشة") { editor.document.setMode("slideshow"); editor.set(.bool(true), key("enabled")) }
                }
                Toggle("تبديل الصور تلقائيًا", isOn: editor.flag(key("playing"), true))
                Toggle("تكرار العرض", isOn: editor.flag(key("loop"), true))
                DesignRange(label: "مدة كل صورة · ثانية", path: key("seconds"), range: 2...120, fallback: 8)
                Picker("المؤثر", selection: editor.text(key("effect"), "fade")) { Text("بدون مؤثر").tag("none"); Text("تلاشي").tag("fade"); Text("انزلاق").tag("slide"); Text("اقتراب").tag("zoom") }
                DesignRange(label: "مدة الانتقال · مللي ثانية", path: key("transitionMs"), range: 0...2000, fallback: 800, step: 100)
            }
            Section("الصور · اسحب للترتيب أو اسحب الصف للحذف") {
                ForEach(Array(images.enumerated()), id: \.offset) { index, image in
                    let id = image.object?["id"]?.text ?? ""
                    NavigationLink { SlideEditor(path: path, id: id) } label: {
                        HStack {
                            AsyncImage(url: URL(string: image.object?["url"]?.text ?? "")) { photo in photo.resizable().scaledToFill() } placeholder: { Image(systemName: "photo") }
                                .frame(width: 56, height: 42).clipped().clipShape(RoundedRectangle(cornerRadius: 7))
                            Text(image.object?["name"]?.text ?? "صورة \(index + 1)")
                        }
                    }.swipeActions { Button("حذف", role: .destructive) { var all = images; all.remove(at: index); editor.setList(all, key("images")) } }
                }.onMove { source, destination in var all = images; all.move(fromOffsets: source, toOffset: destination); editor.setList(all, key("images")) }
                if upload.busy { UploadProgressCard(upload: upload) }
                else {
                    PhotosPicker(selection: $selection, maxSelectionCount: 30, matching: .images, preferredItemEncoding: .compatible) { Label("إضافة صور", systemImage: "photo.badge.plus").frame(minHeight: 44) }
                }
                if let error = upload.error { Text(error).foregroundStyle(.red) }
            }
            Section("طبقة القراءة والمؤثرات") {
                DesignColorField(label: "لون طبقة القراءة", path: key("overlayColor"))
                DesignRange(label: "قوة الطبقة", path: key("overlayOpacity"), range: 0...80, fallback: 0)
                DesignRange(label: "نعومة الخلفية", path: key("blur"), range: 0...12, fallback: 0)
                DesignRange(label: "تشبع الألوان", path: key("saturation"), range: 0...180, fallback: 100)
            }
        }.designPage(title).toolbar { EditButton().disabled(upload.busy) }
            .navigationBarBackButtonHidden(upload.busy)
            .onChange(of: selection) { _, items in
                guard !items.isEmpty else { return }
                upload.startBatch(items, model: app) { media in
                    let image: [String: JSONValue] = ["id": .string(UUID().uuidString), "url": .string(media.url.absoluteString), "name": .string("صورة \(images.count + 1)"), "fit": .string("cover"), "x": .number(50), "y": .number(50), "zoom": .number(100), "brightness": .number(100)]
                    editor.setList(images + [.object(image)], key("images")); editor.set(.bool(true), key("enabled"))
                }; selection = []
            }
            .onChange(of: upload.busy) { _, busy in editor.uploading = busy }
            .onDisappear { upload.cancel(); editor.uploading = false }
    }
}
private struct SlideEditor: View {
    @Environment(DesignStore.self) private var editor
    let path: String; let id: String
    private func get(_ field: String) -> JSONValue? { editor.list(path + ".images").first { $0.object?["id"]?.text == id }?.object?[field] }
    private func set(_ field: String, _ value: JSONValue) {
        var all = editor.list(path + ".images"); guard let index = all.firstIndex(where: { $0.object?["id"]?.text == id }) else { return }
        var slide = all[index].object ?? [:]; if value == .null { slide.removeValue(forKey: field) } else { slide[field] = value }; all[index] = .object(slide); editor.setList(all, path + ".images")
    }
    private func number(_ field: String, _ fallback: Double) -> Binding<Double> { Binding(get: { get(field)?.decimal ?? fallback }, set: { set(field, .number($0)) }) }
    var body: some View {
        Form {
            AsyncImage(url: URL(string: get("url")?.text ?? "")) { photo in photo.resizable().scaledToFit() } placeholder: { ProgressView() }.frame(maxHeight: 220)
            TextField("اسم الصورة", text: Binding(get: { get("name")?.text ?? "" }, set: { set("name", .string($0)) }))
            Picker("ملاءمة الصورة", selection: Binding(get: { get("fit")?.text ?? "cover" }, set: { set("fit", .string($0)) })) { Text("تغطية").tag("cover"); Text("احتواء").tag("contain"); Text("تمدد").tag("fill") }
            slideRange("الموضع الأفقي", "x", 0...100, 50)
            slideRange("الموضع الرأسي", "y", 0...100, 50)
            slideRange("التكبير", "zoom", 100...160, 100)
            slideRange("الإضاءة", "brightness", 40...140, 100)
            Toggle("مدة خاصة لهذه الصورة", isOn: Binding(get: { get("seconds")?.decimal != nil }, set: { set("seconds", $0 ? .number(8) : .null) }))
            if get("seconds")?.decimal != nil { slideRange("المدة · ثانية", "seconds", 2...120, 8) }
            Button("تكرار الصورة") {
                guard let original = editor.list(path + ".images").first(where: { $0.object?["id"]?.text == id })?.object else { return }
                var copy = original; copy["id"] = .string(UUID().uuidString); editor.setList(editor.list(path + ".images") + [.object(copy)], path + ".images")
            }
        }.designPage("تخصيص الصورة")
    }
    private func slideRange(_ label: String, _ field: String, _ range: ClosedRange<Double>, _ fallback: Double) -> some View {
        VStack(alignment: .leading) { LabeledContent(label, value: String(Int(number(field, fallback).wrappedValue))); Slider(value: number(field, fallback), in: range, step: 1).accessibilityLabel(label) }
    }
}
