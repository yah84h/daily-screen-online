import SwiftUI

@MainActor @Observable
final class AppModel {
    #if LOCAL_ONLY
    let localOnly = true
    #else
    let localOnly = false
    #endif
    var showServerSetup = false
    var api: APIClient?
    var staff: Staff?
    var screens: [SchoolScreen] = []
    var loading = true
    var refreshing = false
    var error: String?
    var message: String?
    var demo = false
    var configuration: BackendConfiguration?

    init() {
        #if LOCAL_ONLY
        do {
            if let address = LocalServerSettings.load() {
                let config = try BackendConfiguration.localServer(address)
                configuration = config
                api = try APIClient(configuration: config, storage: KeychainSessionStorage(namespace: config.siteURL.absoluteString))
            }
        } catch { self.error = error.localizedDescription }
        #else
        do {
            guard let url = Bundle.main.url(forResource: "Backend", withExtension: "json") else {
                throw AppError.message("ملف إعداد الاتصال غير موجود.")
            }
            let config = try JSONDecoder().decode(BackendConfiguration.self, from: Data(contentsOf: url))
            let client = try APIClient(configuration: config, storage: KeychainSessionStorage())
            configuration = config; api = client
        } catch { configuration = nil; api = nil; self.error = error.localizedDescription }
        #endif
    }
    func connectLocalServer(_ address: String) async throws {
        let config = try BackendConfiguration.localServer(address)
        let client = try APIClient(configuration: config, storage: KeychainSessionStorage(namespace: config.siteURL.absoluteString))
        try await client.checkLocalServer()
        try LocalServerSettings.save(config.siteURL.absoluteString)
        api = client; configuration = config; staff = nil; screens = []; demo = false
        showServerSetup = false
        await restore()
    }
    func restore() async {
        defer { loading = false }
        guard !demo, let api, await api.hasSession else { return }
        do { staff = try await api.currentStaff(); try await loadScreens() }
        catch AppError.sessionExpired { await api.signOut(); staff = nil }
        catch { self.error = error.localizedDescription }
    }
    func signIn(username: String, password: String) async {
        guard let api else { return }
        loading = true; error = nil
        defer { loading = false }
        do { staff = try await api.signIn(username: username, password: password); try await loadScreens() }
        catch { self.error = readable(error) }
    }
    func loadScreens() async throws {
        guard !demo, let api else { return }
        screens = try await api.screens()
    }
    func refresh() async {
        guard !demo, let api, !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        do { staff = try await api.currentStaff(); try await loadScreens() }
        catch AppError.sessionExpired { staff = nil; await api.signOut(); error = AppError.sessionExpired.localizedDescription }
        catch { self.error = readable(error) }
    }
    func signOut() async {
        demo = false; staff = nil; screens = []; message = nil
        await api?.signOut()
    }
    func startDemo() {
        guard let data = Self.demoStaff.data(using: .utf8),
              let person = try? JSONDecoder().decode(Staff.self, from: data),
              let rows = try? JSONDecoder().decode([SchoolScreen].self, from: Data(Self.demoScreens.utf8)) else { return }
        demo = true; staff = person; screens = rows; loading = false; error = nil
    }
    func readable(_ error: Error) -> String {
        if error is DecodingError { return "تعذر قراءة رد الخدمة. حاول مجددًا أو تواصل مع مسؤول النظام." }
        if let error = error as? URLError {
            if localOnly && [.cannotConnectToHost, .cannotFindHost, .networkConnectionLost, .notConnectedToInternet, .timedOut].contains(error.code) {
                return "تعذر الاتصال بالماك. شغّل الخادم المحلي، واتصل بالشبكة نفسها، واسمح للتطبيق بالوصول إلى الشبكة المحلية من إعدادات الآيفون."
            }
            if error.code == .notConnectedToInternet { return "لا يوجد اتصال بالإنترنت. تأكد من الشبكة ثم حاول مجددًا." }
            if error.code == .timedOut { return "استغرق الاتصال وقتًا طويلًا. حاول مرة أخرى." }
        }
        return error.localizedDescription
    }
    private static let demoStaff = #"{"id":"demo","username":"المعلم","permissions":{"admin":true,"news":true,"daily":true},"active":true}"#
    private static let demoScreens = ##"[{"id":"demo-screen","name":"الشاشة الرئيسية","template":{"displayMode":"daily","background":"#f2f6ff","color":"#254d80","accent":"#4b91f7"},"draft":{"title":"أهلًا بيوم جديد","subtitle":"معًا نصنع أثرًا جميلًا","body":"مساحة لأخبار المدرسة وإنجازات طلابنا.","image":""}}]"##
}
