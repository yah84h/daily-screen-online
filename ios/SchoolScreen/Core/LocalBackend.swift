import Foundation

/// Uses only the configured LAN origin and the standalone server's cookie API.
public actor LocalBackend {
    private let origin: URL
    private let transport: any HTTPTransport
    private let storage: any SessionStorage
    private var session: Session?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    public init(origin: URL, storage: any SessionStorage, transport: any HTTPTransport) throws {
        self.origin = origin; self.storage = storage; self.transport = transport
        session = try storage.load()
    }
    public var hasSession: Bool { session.map { $0.expiresAt > Date() } ?? false }
    private struct AuthResponse: Decodable { var user: Staff? }
    private struct Envelope<T: Decodable>: Decodable { var data: T }
    public func checkServer() async throws {
        struct Status: Decodable { var kind: String; var nativePublish: Bool }
        let status: Status
        do { status = try await call("local/status", authenticated: false) }
        catch is DecodingError { throw AppError.message("حدّث الخادم المحلي باستخدام الحزمة المرفقة مع التطبيق.") }
        guard status.kind == "daily-screen-local", status.nativePublish else {
            throw AppError.message("حدّث نسخة الخادم المحلي إلى النسخة المرفقة مع التطبيق.")
        }
    }
    public func signIn(username: String, password: String) async throws -> Staff {
        let request = try makeRequest("local/auth/login", method: "POST", body: ["username": .string(username.trimmingCharacters(in: .whitespacesAndNewlines)), "password": .string(password)], authenticated: false)
        let (data, response) = try await transport.data(for: request)
        try check(data, response)
        let result = try decoder.decode(AuthResponse.self, from: data)
        guard let user = result.user, user.active, user.canPublish || user.canNews else { throw AppError.message("حسابك لا يملك صلاحيات.") }
        let fields = response.allHeaderFields.reduce(into: [String: String]()) { result, item in
            if let key = item.key as? String, let value = item.value as? String { result[key] = value }
        }
        guard let cookie = HTTPCookie.cookies(withResponseHeaderFields: fields, for: origin).first(where: { $0.name == "ds_session" }),
              cookie.value.range(of: "^[a-f0-9]+$", options: .regularExpression) != nil else {
            throw AppError.message("لم يُرسل الخادم جلسة دخول صالحة. حدّث الخادم المحلي.")
        }
        let value = Session(accessToken: cookie.value, refreshToken: "", expiresAt: cookie.expiresDate ?? Date().addingTimeInterval(12 * 3600))
        try storage.save(value); session = value
        return user
    }
    public func currentStaff() async throws -> Staff {
        let result: AuthResponse = try await call("local/auth/session")
        guard let user = result.user, user.active else { session = nil; try? storage.clear(); throw AppError.sessionExpired }
        return user
    }
    public func signOut() async {
        _ = try? await call("local/auth/logout", method: "POST", body: [:]) as JSONValue
        session = nil; try? storage.clear()
    }
    public func screens() async throws -> [SchoolScreen] {
        try await query(table: "screens", orders: [.array([.string("created_at"), .bool(true)])])
    }
    public func devices(screenID: String) async throws -> [ScreenDevice] {
        try await query(table: "screen_devices", filters: [filter("screen_id", "eq", screenID)])
    }
    public func latestPost(screenID: String) async throws -> ScreenPost? {
        let posts: [ScreenPost] = try await query(table: "posts", filters: [filter("screen_id", "eq", screenID), filter("publish_at", "lte", SchoolTime.today())],
                                                orders: [.array([.string("publish_at"), .bool(false)]), .array([.string("created_at"), .bool(false)])], limit: 1)
        return posts.first
    }
    public func pair(code: String, screenID: String, label: String) async throws {
        guard let code = SchoolTime.pairingCode(code) else { throw AppError.message("أدخل رمزًا من ٦ أرقام.") }
        let _: JSONValue = try await rpc("pair_screen", args: ["p_code": .string(code), "p_screen_id": .string(screenID), "p_label": .string(label)])
    }
    public func publish(screenID: String, announcement: Announcement, mode: String, requestID: UUID) async throws -> PublishReceipt {
        guard announcement.isValid else { throw AppError.message("أضف عنوانًا أو وسائط أولًا.") }
        return try await rpc("publish_from_iphone", args: ["p_screen_id": .string(screenID), "p_content": .object(portable(announcement.values)), "p_mode": .string(mode), "p_request_id": .string(requestID.uuidString)])
    }
    public func saveDraft(screenID: String, announcement: Announcement) async throws {
        let _: JSONValue = try await call("local/query", method: "POST", body: ["table": .string("screens"), "action": .string("update"), "filters": .array([filter("id", "eq", screenID)]), "values": .object(["draft": .object(portable(announcement.values))])])
    }
    public func saveNews(screenID: String, settings: [String: JSONValue]) async throws {
        let _: JSONValue = try await rpc("save_screen_news", args: ["p_screen_id": .string(screenID), "p_news": .object(settings)])
    }
    public func cleanupMedia(remove: Bool) async throws -> JSONValue {
        try await rpc("cleanup_media", args: ["p_remove": .bool(remove)])
    }
    public func records(table: String, filters: [JSONValue], orders: [JSONValue] = []) async throws -> [JSONValue] {
        try await query(table: table, filters: filters, orders: orders)
    }
    public func mutate(table: String, action: String, values: [String: JSONValue]?, filters: [JSONValue]) async throws {
        var body: [String: JSONValue] = ["table": .string(table), "action": .string(action), "filters": .array(filters)]
        if let values { body["values"] = .object(portable(values)) }
        let _: JSONValue = try await call("local/query", method: "POST", body: body)
    }
    public func manageStaff(_ input: [String: JSONValue]) async throws -> JSONValue {
        let result: JSONValue = try await call("local/auth/users", method: "POST", body: input)
        return result.object?["users"] ?? .null
    }
    public func changePassword(current: String, new: String) async throws {
        let _: JSONValue = try await call("local/auth/password", method: "POST", body: ["currentPassword": .string(current), "password": .string(new)])
    }
    public func schedule(screenID: String, content: Announcement, date: String, requestID: UUID) async throws -> PublishReceipt {
        try await rpc("schedule_from_iphone", args: ["p_screen_id": .string(screenID), "p_content": .object(portable(content.values)), "p_date": .string(date), "p_request_id": .string(requestID.uuidString)])
    }
    public func saveTemplate(screenID: String, patch: [String: JSONValue]) async throws {
        let _: JSONValue = try await rpc("save_screen_template", args: ["p_screen_id": .string(screenID), "p_patch": .object(portable(patch))])
    }
    public func upload(file: URL, mime: String, extension fileExtension: String, progress: TransferProgressHandler? = nil) async throws -> URL {
        let supported = ["jpg": "image/jpeg", "png": "image/png", "gif": "image/gif", "mp4": "video/mp4", "webm": "video/webm"]
        guard supported[fileExtension] == mime else { throw AppError.message("نوع الملف غير مدعوم.") }
        let path = "content/\(UUID().uuidString.lowercased()).\(fileExtension)"
        var request = try makeRequest("local/upload/\(path)", method: "POST")
        request.setValue(mime, forHTTPHeaderField: "Content-Type"); request.timeoutInterval = 600
        let result: (Data, HTTPURLResponse)
        if let progress, let observed = transport as? any ProgressHTTPTransport { result = try await observed.upload(for: request, file: file, progress: progress) }
        else { result = try await transport.upload(for: request, file: file) }
        let (data, response) = result
        try check(data, response)
        return origin.appendingPathComponent("storage/v1/object/public/media/\(path)")
    }
    private func filter(_ key: String, _ operation: String, _ value: String) -> JSONValue { .array([.string(key), .string(operation), .string(value)]) }
    private func query<T: Decodable>(table: String, filters: [JSONValue] = [], orders: [JSONValue] = [], limit: Int? = nil) async throws -> T {
        var body: [String: JSONValue] = ["table": .string(table), "action": .string("select"), "filters": .array(filters), "orders": .array(orders)]
        if let limit { body["limit"] = .number(Double(limit)) }
        let result: Envelope<T> = try await call("local/query", method: "POST", body: body)
        return result.data
    }
    private func rpc<T: Decodable>(_ name: String, args: [String: JSONValue]) async throws -> T {
        let result: Envelope<T> = try await call("local/rpc", method: "POST", body: ["name": .string(name), "args": .object(args)])
        return result.data
    }
    private func call<T: Decodable>(_ path: String, method: String = "GET", body: [String: JSONValue]? = nil, authenticated: Bool = true) async throws -> T {
        let request = try makeRequest(path, method: method, body: body, authenticated: authenticated)
        let (data, response) = try await transport.data(for: request)
        try check(data, response)
        // Resolve only media URLs against this server; never fetch cloud assets in local mode.
        let json = try decoder.decode(JSONValue.self, from: data)
        return try decoder.decode(T.self, from: encoder.encode(normalize(json)))
    }
    private func makeRequest(_ path: String, method: String = "GET", body: [String: JSONValue]? = nil, authenticated: Bool = true) throws -> URLRequest {
        var request = URLRequest(url: origin.appendingPathComponent(path)); request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if authenticated {
            guard let session, session.expiresAt > Date() else { throw AppError.sessionExpired }
            request.setValue("ds_session=\(session.accessToken)", forHTTPHeaderField: "Cookie")
        }
        if let body { request.httpBody = try encoder.encode(body) }
        return request
    }
    private func check(_ data: Data, _ response: HTTPURLResponse) throws {
        if response.statusCode == 401 { session = nil; try? storage.clear(); throw AppError.sessionExpired }
        guard (200..<300).contains(response.statusCode) else {
            let json = try? decoder.decode([String: JSONValue].self, from: data)
            if let message = json?["error"]?.object?["message"]?.text { throw AppError.message(message) }
            if response.statusCode == 404 { throw AppError.message("هذا ليس خادم الشاشة المحلية أو يحتاج إلى تحديث.") }
            throw AppError.http(response.statusCode, "")
        }
    }
    private let mediaKeys: Set<String> = ["image", "secondary", "qr", "logo", "backgroundImage", "logo_url", "schoolLogo", "fullMedia", "photo", "url"]
    private func normalize(_ value: JSONValue, key: String = "") -> JSONValue {
        switch value {
        case .object(let object): return .object(object.mapValuesWithKeys { normalize($1, key: $0) })
        case .array(let array): return .array(array.map { normalize($0) })
        case .string(let string) where mediaKeys.contains(key):
            if string.isEmpty { return value }
            if string.hasPrefix("/") && !string.hasPrefix("//") { return .string(origin.appendingPathComponent(String(string.dropFirst())).absoluteString) }
            if let url = URL(string: string), url.path.hasPrefix("/storage/v1/object/public/media/") {
                return .string(origin.appendingPathComponent(String(url.path.dropFirst())).absoluteString)
            }
            if let url = URL(string: string), url.host == origin.host, url.port == origin.port, url.scheme == origin.scheme { return value }
            return .string("")
        default: return value
        }
    }
    private func portable(_ object: [String: JSONValue]) -> [String: JSONValue] {
        func convert(_ value: JSONValue, key: String = "") -> JSONValue {
            if let object = value.object { return .object(object.mapValuesWithKeys { convert($1, key: $0) }) }
            if let array = value.list { return .array(array.map { convert($0) }) }
            if let text = value.text, mediaKeys.contains(key), let url = URL(string: text), url.host == origin.host, url.port == origin.port { return .string(url.path) }
            return value
        }
        return object.mapValuesWithKeys { convert($1, key: $0) }
    }

}
private extension Dictionary where Key == String, Value == JSONValue {
    func mapValuesWithKeys(_ transform: (String, JSONValue) -> JSONValue) -> [String: JSONValue] {
        Dictionary(uniqueKeysWithValues: map { ($0.key, transform($0.key, $0.value)) })
    }
}
