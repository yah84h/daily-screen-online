import SwiftUI

struct RecognitionEditor: View {
    @Environment(DesignStore.self) private var editor
    private var students: [JSONValue] { editor.list("recognition.students") }
    var body: some View {
        Form {
            Section("لوحة التميز") {
                Toggle("إظهار اللوحة", isOn: editor.flag("recognition.enabled"))
                TextField("عنوان اللوحة", text: editor.text("recognition.title", "نجوم الأسبوع"))
                TextField("العبارة التعريفية", text: editor.text("recognition.subtitle", "نحتفي بالتعلم والتميز"))
                Picker("طريقة العرض", selection: editor.text("recognition.style", "classic")) { Text("كلاسيكي").tag("classic"); Text("طالب واحد").tag("solo"); Text("مجموعة").tag("group") }
                if editor.value("recognition.style")?.text == "group" {
                    Picker("عدد الطلاب في الصفحة", selection: editor.number("recognition.groupSize", 2)) { Text("٢").tag(2.0); Text("٣").tag(3.0); Text("٤").tag(4.0) }
                }
                DesignRange(label: "مدة الصفحة · ثانية", path: "recognition.pageSeconds", range: 5...60, fallback: 10)
                DesignRange(label: "عرض اللوحة", path: "recognition.width", range: 20...34, fallback: 27)
                DesignRange(label: "ارتفاع اللوحة", path: "recognition.height", range: 44...53, fallback: 50)
            }
            Section("الطلاب · حتى ٣٠ طالبًا") {
                ForEach(Array(students.enumerated()), id: \.offset) { index, student in
                    let id = student.object?["id"]?.text ?? ""
                    NavigationLink { StudentEditor(id: id) } label: {
                        Label(student.object?["name"]?.text.flatMap { $0.isEmpty ? nil : $0 } ?? "طالب جديد", systemImage: "person.crop.circle")
                    }
                    .swipeActions { Button("حذف", role: .destructive) { var all = students; all.remove(at: index); editor.setList(all, "recognition.students") } }
                }
                .onMove { source, destination in var all = students; all.move(fromOffsets: source, toOffset: destination); editor.setList(all, "recognition.students") }
                Button { editor.setList(students + [.object(["id": .string(UUID().uuidString), "name": .string(""), "achievement": .string("")])], "recognition.students") } label: { Label("إضافة طالب", systemImage: "plus.circle") }.disabled(students.count >= 30)
            }
            InfoNote(text: "إخفاء اللوحة يحتفظ بالأسماء والصور. التغييرات تصل للتلفزيون عند تطبيق التصميم.")
        }.toolbar { EditButton() }.designPage("لوحة التميز")
    }
}
private struct StudentEditor: View {
    @Environment(DesignStore.self) private var editor
    let id: String
    private func binding(_ key: String) -> Binding<String> {
        Binding(get: { editor.list("recognition.students").first { $0.object?["id"]?.text == id }?.object?[key]?.text ?? "" }, set: { value in
            var all = editor.list("recognition.students"); guard let index = all.firstIndex(where: { $0.object?["id"]?.text == id }) else { return }
            var student = all[index].object ?? [:]; student[key] = .string(value); all[index] = .object(student); editor.setList(all, "recognition.students")
        })
    }
    var body: some View {
        Form {
            TextField("اسم الطالب", text: binding("name"))
            TextField("الإنجاز أو الصف", text: binding("achievement"), axis: .vertical)
            PhotoUploadRow(title: "صورة الطالب", url: binding("photo"), onBusy: { editor.uploading = $0 })
        }.designPage("بيانات الطالب")
    }
}
