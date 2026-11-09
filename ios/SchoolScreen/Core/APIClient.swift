import Foundation

public protocol HTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse)
    func upload(for request: URLRequest, file: URL) async throws -> (Data, HTTPURLResponse)
}
public struct URLSessionTransport: ProgressHTTPTransport {
    private let localOrigin: URL?
    private let session: URLSession
    public init(localOrigin: URL? = nil) {
        self.localOrigin = localOrigin
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.timeoutIntervalForRequest = 30; config.timeoutIntervalForResource = 600
        session = URLSession(configuration: config, delegate: localOrigin.map(LocalRedirectPolicy.init), delegateQueue: nil)
    }
    public func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw AppError.message("تعذر الاتصال بالخادم.") }
        return (data, response)
    }
    public func upload(for request: URLRequest, file: URL) async throws -> (Data, HTTPURLResponse) {
        try await upload(for: request, file: file, progress: { _ in })
    }
    public func upload(for request: URLRequest, file: URL, progress: @escaping TransferProgressHandler) async throws -> (Data, HTTPURLResponse) {
        let observer = UploadObserver(origin: localOrigin, progress: progress)
        let (data, response) = try await session.upload(for: request, fromFile: file, delegate: observer)
        guard let response = response as? HTTPURLResponse else { throw AppError.message("تعذر رفع الملف.") }
        return (data, response)
    }
}

public actor APIClient {
    private let localBackend: LocalBackend?
    private let config: BackendConfiguration
    private let transport: any HTTPTransport
    private let storage: any SessionStorage
    private var session: Session?
    private var refreshTask: Task<Session, Error>?
    private var authGeneration = 0
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    public init(configuration: BackendConfiguration, storage: any SessionStorage, transport: (any HTTPTransport)? = nil) throws {
        try configuration.validate(); config = configuration; self.storage = storage
        let selected = transport ?? URLSessionTransport(localOrigin: configuration.isLocal ? configuration.siteURL : nil)
        self.transport = selected
        localBackend = configuration.isLocal ? try LocalBackend(origin: configuration.siteURL, storage: storage, transport: selected) : nil
        session = configuration.isLocal ? nil : try storage.load()
    }
    public var hasSession: Bool { get async { if let localBackend { return await localBackend.hasSession }; return session != nil } }
    public func checkLocalServer() async throws { try await localBackend?.checkServer() }

    private struct TokenResponse: Decodable {
        var access_token: String
        var refresh_token: String
        var expires_in: Double?
        var expires_at: Double?
        var stored: Session {
            Session(accessToken: access_token, refreshToken: refresh_token,
                    expiresAt: expires_at.map { Date(timeIntervalSince1970: $0) } ?? Date().addingTimeInterval(expires_in ?? 0))
        }
    }
    public func signIn(username: String, password: String) async throws -> Staff {
        if let localBackend { return try await localBackend.signIn(username: username, password: password) }
        let username = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !username.isEmpty, !password.isEmpty else { throw AppError.message("أدخل اسم المستخدم وكلمة المرور.") }
        var response: TokenResponse
        if username.contains("@") {
            do {
                response = try await rawToken(path: "auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "password")],
                                              body: ["email": .string(username), "password": .string(password)])
            } catch let primaryError as AppError {
                guard case .http(let status, _) = primaryError, status == 400 || status == 401 else { throw primaryError }
                // Email-shaped staff usernames also exist. A resolver success is useful,
                // but its failure must never hide the original email-authentication error.
                do { response = try await usernameLogin(username, password) }
                catch { throw primaryError }
            }
        } else {
            do { response = try await usernameLogin(username, password) }
            catch AppError.http(let status, _) where status >= 500 {
                throw AppError.message("تعذر الوصول إلى خدمة تسجيل الدخول باسم المستخدم. جرّب بريد الحساب أو تواصل مع مسؤول النظام.")
            }
        }
        let value = response.stored
        try storage.save(value); session = value
        do {
            let staff = try await currentStaff()
            guard staff.active, staff.canPublish || staff.canNews else { throw AppError.message("حسابك لا يملك صلاحيات. تواصل مع المسؤول.") }
            guard staff.mustChangePassword != true else { throw AppError.message("غيّر كلمة المرور من الموقع أولًا ثم عد للتطبيق.") }
            return staff
        } catch { session = nil; try? storage.clear(); throw error }
    }
    private func usernameLogin(_ username: String, _ password: String) async throws -> TokenResponse {
        let request = try makeRequest(base: config.siteURL, path: ".netlify/functions/staff-login", method: "POST",
                                      body: ["username": .string(username), "password": .string(password)])
        return try decode(TokenResponse.self, await transport.data(for: request))
    }
    private func rawToken(path: String, query: [URLQueryItem], body: [String: JSONValue]) async throws -> TokenResponse {
        let request = try makeRequest(base: config.supabaseURL, path: path, method: "POST", query: query, body: body)
        return try decode(TokenResponse.self, await transport.data(for: request))
    }
    private func accessToken() async throws -> String {
        guard let current = session else { throw AppError.sessionExpired }
        if current.expiresAt.timeIntervalSinceNow > 60 { return current.accessToken }
        if let refreshTask { return try await refreshTask.value.accessToken }
        let generation = authGeneration
        let task = Task {
            try await self.rawToken(path: "auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "refresh_token")],
                                    body: ["refresh_token": .string(current.refreshToken)]).stored
        }
        refreshTask = task
        do {
            let renewed = try await task.value
            guard generation == authGeneration else { throw AppError.sessionExpired }
            try storage.save(renewed); session = renewed; refreshTask = nil
            return renewed.accessToken
        } catch {
            refreshTask = nil
            if case AppError.http(let status, _) = error, status == 400 || status == 401 {
                session = nil; try? storage.clear(); throw AppError.sessionExpired
            }
            throw error
        }
    }
    public func signOut() async {
        if let localBackend { await localBackend.signOut(); return }
        authGeneration += 1; refreshTask?.cancel(); refreshTask = nil
        let token = session?.accessToken
        session = nil; try? storage.clear()
        if let token,
           var request = try? makeRequest(base: config.supabaseURL, path: "auth/v1/logout", method: "POST", query: [.init(name: "scope", value: "local")]) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try? await transport.data(for: request)
        }
    }
    public func currentStaff() async throws -> Staff {
        if let localBackend { return try await localBackend.currentStaff() }
        let staff: Staff? = try await request("rest/v1/rpc/current_staff", method: "POST", body: [:])
        guard let staff, staff.active else { throw AppError.sessionExpired }
        return staff
    }
    public func screens() async throws -> [SchoolScreen] {
        if let localBackend { return try await localBackend.screens() }
        return try await request("rest/v1/screens", query: [.init(name: "select", value: "id,name,template,draft"), .init(name: "order", value: "created_at.asc")])
    }
    public func devices(screenID: String) async throws -> [ScreenDevice] {
        if let localBackend { return try await localBackend.devices(screenID: screenID) }
        return try await request("rest/v1/screen_devices", query: [.init(name: "select", value: "code,screen_id,label,last_seen_at"), .init(name: "screen_id", value: "eq.\(screenID)")])
    }
    public func latestPost(screenID: String) async throws -> ScreenPost? {
        if let localBackend { return try await localBackend.latestPost(screenID: screenID) }
        let rows: [ScreenPost] = try await request("rest/v1/posts", query: [
            .init(name: "select", value: "id,screen_id,content,publish_at"), .init(name: "screen_id", value: "eq.\(screenID)"),
            .init(name: "publish_at", value: "lte.\(SchoolTime.today())"),
            .init(name: "order", value: "publish_at.desc,created_at.desc"), .init(name: "limit", value: "1")])
        return rows.first
    }
    public func pair(code: String, screenID: String, label: String) async throws {
        if let localBackend { try await localBackend.pair(code: code, screenID: screenID, label: label); return }
        guard let code = SchoolTime.pairingCode(code) else { throw AppError.message("أدخل رمز الربط المكوّن من ٦ أرقام.") }
        let _: JSONValue = try await request("rest/v1/rpc/pair_screen", method: "POST", body: [
            "p_code": .string(code), "p_screen_id": .string(screenID), "p_label": .string(label)])
    }
    public func publish(screenID: String, announcement: Announcement, mode: String, requestID: UUID) async throws -> PublishReceipt {
        if let localBackend { return try await localBackend.publish(screenID: screenID, announcement: announcement, mode: mode, requestID: requestID) }
        guard announcement.isValid else { throw AppError.message("أضف عنوانًا أو وسائط قبل النشر.") }
        return try await request("rest/v1/rpc/publish_from_iphone", method: "POST", body: [
            "p_screen_id": .string(screenID), "p_content": .object(announcement.values),
            "p_mode": .string(mode), "p_request_id": .string(requestID.uuidString)])
    }
    public func saveDraft(screenID: String, announcement: Announcement) async throws {
        if let localBackend { try await localBackend.saveDraft(screenID: screenID, announcement: announcement); return }
        let _: JSONValue = try await request("rest/v1/screens", method: "PATCH", query: [.init(name: "id", value: "eq.\(screenID)")], body: ["draft": .object(announcement.values)])
    }
    public func saveNews(screenID: String, settings: [String: JSONValue]) async throws {
        if let localBackend { try await localBackend.saveNews(screenID: screenID, settings: settings); return }
        let _: JSONValue = try await request("rest/v1/rpc/save_screen_news", method: "POST", body: ["p_screen_id": .string(screenID), "p_news": .object(settings)])
    }
    public func cleanupLocalMedia(remove: Bool) async throws -> JSONValue {
        guard let localBackend else { throw AppError.message("هذه الإدارة متاحة في النسخة المحلية.") }
        return try await localBackend.cleanupMedia(remove: remove)
    }
    public func localRecords(table: String, filters: [JSONValue] = [], orders: [JSONValue] = []) async throws -> [JSONValue] {
        guard let localBackend else { throw AppError.message("هذه الإدارة متاحة في النسخة المحلية.") }
        return try await localBackend.records(table: table, filters: filters, orders: orders)
    }
    public func localMutate(table: String, action: String, values: [String: JSONValue]? = nil, filters: [JSONValue] = []) async throws {
        guard let localBackend else { throw AppError.message("هذه الإدارة متاحة في النسخة المحلية.") }
        try await localBackend.mutate(table: table, action: action, values: values, filters: filters)
    }
    public func manageLocalStaff(_ input: [String: JSONValue]) async throws -> JSONValue {
        guard let localBackend else { throw AppError.message("هذه الإدارة متاحة في النسخة المحلية.") }
        return try await localBackend.manageStaff(input)
    }
    public func changeLocalPassword(current: String, new: String) async throws {
        guard let localBackend else { throw AppError.message("هذه الإدارة متاحة في النسخة المحلية.") }
        try await localBackend.changePassword(current: current, new: new)
    }
    public func scheduleLocal(screenID: String, content: Announcement, date: String, requestID: UUID) async throws -> PublishReceipt {
        guard let localBackend else { throw AppError.message("هذه الإدارة متاحة في النسخة المحلية.") }
        return try await localBackend.schedule(screenID: screenID, content: content, date: date, requestID: requestID)
    }
    public func saveTemplate(screenID: String, patch: [String: JSONValue]) async throws {
        if let localBackend { try await localBackend.saveTemplate(screenID: screenID, patch: patch); return }
        guard let screen = try await screens().first(where: { $0.id == screenID }) else { throw AppError.message("الشاشة غير موجودة.") }
        let template = DesignPatch.merge(screen.template, patch: patch)
        let _: JSONValue = try await request("rest/v1/screens", method: "PATCH", query: [.init(name: "id", value: "eq.\(screenID)")], body: ["template": .object(template)])
    }
    public func upload(file: URL, mime: String, extension fileExtension: String, progress: TransferProgressHandler? = nil) async throws -> URL {
        if let localBackend { return try await localBackend.upload(file: file, mime: mime, extension: fileExtension, progress: progress) }
        let allowed = ["jpg": "image/jpeg", "png": "image/png", "gif": "image/gif", "mp4": "video/mp4", "webm": "video/webm"]
        guard allowed[fileExtension] == mime else { throw AppError.message("نوع الملف غير مدعوم.") }
        let token = try await accessToken()
        let path = "content/\(UUID().uuidString.lowercased()).\(fileExtension)"
        var request = try makeRequest(base: config.supabaseURL, path: "storage/v1/object/media/\(path)", method: "POST")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(mime, forHTTPHeaderField: "Content-Type")
        request.setValue("31536000", forHTTPHeaderField: "cache-control")
        request.timeoutInterval = 600
        let result: (Data, HTTPURLResponse)
        if let progress, let observed = transport as? any ProgressHTTPTransport { result = try await observed.upload(for: request, file: file, progress: progress) }
        else { result = try await transport.upload(for: request, file: file) }
        let (data, response) = result
        try check(data, response)
        return config.supabaseURL.appendingPathComponent("storage/v1/object/public/media/\(path)")
    }
    private func request<T: Decodable>(_ path: String, method: String = "GET", query: [URLQueryItem] = [], body: [String: JSONValue]? = nil) async throws -> T {
        let token = try await accessToken()
        var request = try makeRequest(base: config.supabaseURL, path: path, method: method, query: query, body: body)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let result = try await transport.data(for: request)
        if result.1.statusCode == 401 { session?.expiresAt = .distantPast; throw AppError.sessionExpired }
        return try decode(T.self, result)
    }
    private func makeRequest(base: URL, path: String, method: String, query: [URLQueryItem] = [], body: [String: JSONValue]? = nil) throws -> URLRequest {
        var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw AppError.message("عنوان الخدمة غير صحيح.") }
        var request = URLRequest(url: url); request.httpMethod = method
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body { request.httpBody = try encoder.encode(body) }
        return request
    }
    private func decode<T: Decodable>(_ type: T.Type, _ response: (Data, HTTPURLResponse)) throws -> T {
        try check(response.0, response.1)
        return try decoder.decode(type, from: response.0.isEmpty ? Data("null".utf8) : response.0)
    }
    private func check(_ data: Data, _ response: HTTPURLResponse) throws {
        guard (200..<300).contains(response.statusCode) else {
            let json = (try? decoder.decode([String: JSONValue].self, from: data)) ?? [:]
            let message = json["message"]?.text ?? json["error_description"]?.text ?? json["msg"]?.text ?? json["error"]?.text ?? json["error_code"]?.text ?? ""
            throw AppError.http(response.statusCode, message)
        }
    }
}

private final class LocalRedirectPolicy: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    let origin: URL
    init(_ origin: URL) { self.origin = origin }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        let url = request.url
        completionHandler(url?.host == origin.host && url?.port == origin.port && url?.scheme == origin.scheme ? request : nil)
    }
}

private final class UploadObserver: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    let origin: URL?
    let progress: TransferProgressHandler
    init(origin: URL?, progress: @escaping TransferProgressHandler) { self.origin = origin; self.progress = progress }
    func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
        progress(TransferProgress(sent: totalBytesSent, total: totalBytesExpectedToSend))
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        guard let origin else { completionHandler(request); return }
        completionHandler(request.url?.host == origin.host && request.url?.port == origin.port && request.url?.scheme == origin.scheme ? request : nil)
    }
}
