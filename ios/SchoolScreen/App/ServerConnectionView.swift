import SwiftUI

struct ServerConnectionView: View {
    @Environment(AppModel.self) private var model
    @State private var address = ""
    @State private var connecting = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BrandMark().padding(.top, 28)
                    Text("شاشتك،\nعلى شبكتك.").font(.largeTitle.bold())
                    Text("نسخة محلية فقط. لا تحتاج إلى موقع المدرسة أو حساب سحابي.")
                        .font(.title3).foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 18) {
                        Label("١. شغّل الخادم على الماك", systemImage: "desktopcomputer")
                        Text("افتح Start-Mac.command من حزمة الخادم المرفقة، وأبقِ النافذة مفتوحة.")
                            .foregroundStyle(.secondary)
                        Label("٢. اتصل بالشبكة نفسها", systemImage: "wifi")
                        Text("استخدم عنوان الماك الذي يظهر في نافذة الخادم. اسمح بالوصول إلى الشبكة المحلية عند طلب الآيفون.")
                            .foregroundStyle(.secondary)
                        TextField("http://192.168.1.10:8080", text: $address)
                            .textFieldStyle(.roundedBorder).keyboardType(.URL)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                            .environment(\.layoutDirection, .leftToRight)
                            .accessibilityLabel("عنوان الخادم المحلي")
                        if let error { Text(error).foregroundStyle(.red) }
                        PrimaryButton(title: "اتصال بالماك", icon: "wifi", busy: connecting,
                                      disabled: address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                            Task { await connect() }
                        }
                    }.padding(22).background(.background, in: RoundedRectangle(cornerRadius: 22))
                    InfoNote(text: "عنوان localhost يشير إلى الآيفون نفسه. أدخل عنوان الماك على الشبكة، مثل 192.168.1.10.")
                    Button("جولة تجريبية بدون خادم") {
                        model.startDemo(); model.showServerSetup = false
                    }.frame(maxWidth: .infinity, minHeight: 44)
                }.padding(24).frame(maxWidth: 560).frame(maxWidth: .infinity)
            }.background(Brand.background).disabled(connecting)
                .onAppear { address = model.configuration?.siteURL.absoluteString ?? LocalServerSettings.suggestedAddress }
        }
    }
    private func connect() async {
        connecting = true; error = nil
        defer { connecting = false }
        do { try await model.connectLocalServer(address) }
        catch { self.error = model.readable(error) }
    }
}
enum LocalServerSettings {
    private static var file: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("LocalServer.json")
    }
    static func load() -> String? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(String.self, from: data)
    }
    static func save(_ address: String) throws {
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(address).write(to: file, options: [.atomic, .completeFileProtection])
    }
    static var suggestedAddress: String {
        guard let url = Bundle.main.url(forResource: "LocalDefaults", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let config = try? JSONDecoder().decode([String: String].self, from: data) else { return "" }
        return config["suggestedAddress"] ?? ""
    }
}
