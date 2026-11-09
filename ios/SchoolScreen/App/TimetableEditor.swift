import SwiftUI

struct TimetableEditor: View {
    @Environment(DesignStore.self) private var editor
    private let names = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة"]
    private var periods: [[String]] {
        let custom = editor.document.value("timetable.periods")?.list?.map { $0.list?.compactMap { $0.text } ?? [] }
        let season = editor.value("timetableSeason")?.text ?? (custom == nil ? "summer" : "custom")
        let normal = DesignResources.defaults["timetable"]?.object?["periods"]?.list?.map { $0.list?.compactMap { $0.text } ?? [] } ?? []
        if season == "custom", let custom, custom.count == 7 { return custom }
        return normal.map { $0.map { text in
            guard season == "winter" else { return text }
            let p = text.split(separator: ":").compactMap { Int($0) }; guard p.count == 2 else { return text }
            let value = p[0] * 60 + p[1] + 30; return String(format: "%02d:%02d", value / 60, value % 60)
        } }
    }
    var body: some View {
        Form {
            Section("الساعة والواجهة") {
                Toggle("انتقالات الساعة والحصص", isOn: editor.flag("animateClock", true))
                DesignRange(label: "حجم الواجهة", path: "loopScale", range: 75...110, fallback: 100)
                DesignRange(label: "حجم الساعة", path: "clockScale", range: 65...115, fallback: 100)
                DesignRange(label: "حجم لوحة التميز", path: "boardScale", range: 65...115, fallback: 100)
            }
            Section("الجدول الدراسي") {
                Picker("نظام التوقيت", selection: Binding(get: { editor.value("timetableSeason")?.text ?? (editor.document.value("timetable") == nil ? "summer" : "custom") }, set: { season in
                    if season == "custom" { editor.set(.object(["periods": .array(periods.map { .array($0.map(JSONValue.string)) })]), "timetable") }; editor.set(.string(season), "timetableSeason")
                })) {
                    Text("صيفي").tag("summer"); Text("شتوي · تأخير ٣٠ دقيقة").tag("winter"); Text("مخصص").tag("custom")
                }
                ForEach(0..<min(7, periods.count), id: \.self) { index in
                    VStack(alignment: .leading, spacing: 8) {
                        Text("الحصة " + names[index]).font(.headline)
                        HStack {
                            DatePicker("البداية", selection: time(index, 0), displayedComponents: .hourAndMinute)
                            DatePicker("النهاية", selection: time(index, 1), displayedComponents: .hourAndMinute)
                        }.environment(\.locale, Locale(identifier: "en_GB")).environment(\.timeZone, TimeZone(secondsFromGMT: 0)!)
                    }.padding(.vertical, 5)
                }
                InfoNote(text: "التوقيت: جدة. تعديل وقت أي حصة يحوّل الجدول إلى مخصص. الخميس ست حصص؛ الجمعة والسبت عطلة. الفسحة بين الثالثة والرابعة.")
            }
            Section("رسالة نهاية اليوم") {
                TextField("العنوان", text: editor.text("dismissalLabel", "الصلاه / صرفه"))
                TextField("العبارة", text: editor.text("dismissalDetail", "نلقاكم بخير"))
            }
        }.designPage("الساعة والحصص")
    }
    private func time(_ index: Int, _ edge: Int) -> Binding<Date> {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(secondsFromGMT: 0); f.dateFormat = "HH:mm"
        return Binding(get: { f.date(from: periods[safe: index]?[safe: edge] ?? "07:00") ?? Date() }, set: { value in
            var all = periods; guard all.indices.contains(index), all[index].indices.contains(edge) else { return }
            all[index][edge] = f.string(from: value)
            editor.set(.object(["periods": .array(all.map { .array($0.map(JSONValue.string)) })]), "timetable")
            editor.set(.string("custom"), "timetableSeason")
        })
    }
}
private extension Array { subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil } }
