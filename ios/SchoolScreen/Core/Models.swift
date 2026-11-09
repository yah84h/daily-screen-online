import Foundation

/// Unknown template/content fields survive edits made by this client.
public enum JSONValue: Codable, Equatable, Sendable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([String: JSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
    public var text: String? { if case .string(let s) = self { return s }; return nil }
    public var object: [String: JSONValue]? { if case .object(let o) = self { return o }; return nil }
}

public enum BackendMode: String, Codable, Sendable { case cloud, local }

public struct BackendConfiguration: Codable, Sendable {
    public var mode: BackendMode?
    public var isLocal: Bool { mode == .local }
    public var siteURL: URL
    public var supabaseURL: URL
    public var anonKey: String
    public init(siteURL: URL, supabaseURL: URL, anonKey: String, mode: BackendMode? = nil) {
        self.mode = mode; self.siteURL = siteURL; self.supabaseURL = supabaseURL; self.anonKey = anonKey
    }
    public func validate() throws {
        if isLocal {
            guard ["http", "https"].contains(siteURL.scheme ?? ""), let host = siteURL.host,
                  Self.isLocalHost(host), siteURL.user == nil, siteURL.password == nil,
                  siteURL.query == nil, siteURL.fragment == nil,
                  siteURL.path.isEmpty || siteURL.path == "/" else {
                throw AppError.message("أدخل عنوان الخادم المحلي فقط، مثل http://192.168.1.10:8080")
            }
            return
        }
        guard siteURL.scheme == "https", supabaseURL.scheme == "https",
              siteURL.host != nil, supabaseURL.host != nil, !anonKey.isEmpty else {
            throw AppError.message("إعداد الاتصال غير مكتمل. تواصل مع مسؤول التطبيق.")
        }
        guard !anonKey.hasPrefix("sb_secret_") else { throw AppError.message("لا يجوز استخدام مفتاح الخادم في التطبيق.") }
        if anonKey.hasPrefix("eyJ"), let payload = anonKey.split(separator: ".").dropFirst().first {
            var text = String(payload).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
            text += String(repeating: "=", count: (4 - text.count % 4) % 4)
            if let data = Data(base64Encoded: text),
               let json = try? JSONDecoder().decode([String: JSONValue].self, from: data),
               json["role"]?.text != "anon" { throw AppError.message("استخدم المفتاح العام فقط.") }
        }
    }
    public static func localServer(_ address: String) throws -> BackendConfiguration {
        let text = address.trimmingCharacters(in: .whitespacesAndNewlines)
        let qualified = text.contains("://") ? text : "http://" + text
        guard let url = URL(string: qualified) else { throw AppError.message("عنوان الخادم غير صحيح.") }
        let config = BackendConfiguration(siteURL: url, supabaseURL: url, anonKey: "", mode: .local)
        try config.validate(); return config
    }
    private static func isLocalHost(_ host: String) -> Bool {
        let host = host.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        if host == "localhost" || host == "::1" || host.hasSuffix(".local") { return true }
        if host.hasPrefix("fd") && host.contains(":") || host.hasPrefix("fc") && host.contains(":") || host.hasPrefix("fe80:") { return true }
        let raw = host.split(separator: ".", omittingEmptySubsequences: false)
        let parts = raw.compactMap { Int($0) }
        guard raw.count == 4, parts.count == 4, parts.allSatisfy({ (0...255).contains($0) }) else { return false }
        return parts[0] == 10 || parts[0] == 127 || parts[0] == 192 && parts[1] == 168 || parts[0] == 172 && (16...31).contains(parts[1]) || parts[0] == 169 && parts[1] == 254
    }
}

public enum AppError: LocalizedError, Equatable, Sendable {
    case message(String), sessionExpired, http(Int, String)
    public var errorDescription: String? {
        switch self {
        case .message(let s): return s
        case .sessionExpired: return "انتهت جلسة الدخول. سجّل الدخول مرة أخرى."
        case .http(let code, let s):
            let detail = s.lowercased()
            if detail.contains("invalid login credentials") || detail == "invalid_credentials" {
                return "البريد أو كلمة المرور غير صحيحة لهذا الحساب. استخدم بيانات حساب المدرسة الحالية."
            }
            if detail.contains("email not confirmed") || detail == "email_not_confirmed" {
                return "يلزم تأكيد بريد الحساب قبل تسجيل الدخول."
            }
            if detail.contains("user is banned") || detail == "user_banned" {
                return "هذا الحساب موقوف. تواصل مع مسؤول المدرسة."
            }
            if code == 404 || s.contains("publish_from_iphone") { return "يلزم تحديث خدمة النشر للتطبيق. تواصل مع مسؤول النظام." }
            if code == 401 { return "اسم المستخدم أو كلمة المرور غير صحيحة، أو انتهت الجلسة." }
            if code == 403 { return "حسابك لا يملك صلاحية تنفيذ هذا الإجراء." }
            if code == 429 { return "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة." }
            if code >= 500 { return "الخدمة غير متاحة الآن. حاول بعد قليل." }
            return s.isEmpty ? "تعذر إكمال الطلب. حاول مرة أخرى." : s
        }
    }
}

public struct Session: Codable, Equatable, Sendable {
    public var accessToken: String
    public var refreshToken: String
    public var expiresAt: Date
    public init(accessToken: String, refreshToken: String, expiresAt: Date = .distantPast) {
        self.accessToken = accessToken; self.refreshToken = refreshToken; self.expiresAt = expiresAt
    }
}
public protocol SessionStorage: Sendable {
    func load() throws -> Session?
    func save(_ session: Session) throws
    func clear() throws
}
public struct Staff: Codable, Equatable, Sendable {
    public struct Permissions: Codable, Equatable, Sendable {
        public var admin: Bool
        public var news: Bool
        public var daily: Bool
    }
    public var id: String
    public var username: String
    public var permissions: Permissions
    public var active: Bool
    public var mustChangePassword: Bool?
    public var canPublish: Bool { active && (permissions.admin || permissions.daily) }
    public var canPair: Bool { active && permissions.admin }
    public var canNews: Bool { active && (permissions.admin || permissions.news) }
}
public struct SchoolScreen: Codable, Identifiable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var template: [String: JSONValue]
    public var draft: [String: JSONValue]?
    public var mode: String { template["displayMode"]?.text ?? "daily" }
}
public struct ScreenPost: Codable, Identifiable, Sendable {
    public var id: String
    public var screen_id: String
    public var content: [String: JSONValue]
    public var publish_at: String
}
public struct ScreenDevice: Codable, Identifiable, Sendable {
    // Do not request/store the device's bearer token in an admin list.
    public var code: String
    public var screen_id: String?
    public var label: String?
    public var last_seen_at: String?
    public var id: String { code }
    public func isOnline(now: Date = Date()) -> Bool {
        guard let last_seen_at, let date = Self.parseDate(last_seen_at) else { return false }
        return now.timeIntervalSince(date) < 90 && now.timeIntervalSince(date) > -30
    }
    private static func parseDate(_ value: String) -> Date? {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
public struct PublishReceipt: Codable, Sendable {
    public var id: String
    public var publish_at: String
}
public struct Announcement: Equatable, Sendable {
    public var values: [String: JSONValue]
    public init(values: [String: JSONValue] = [:]) {
        let defaults: [String: JSONValue] = [
            "title": .string(""), "subtitle": .string(""), "body": .string(""),
            "badge": .string("موضوع اليوم"), "footer": .string(""), "image": .string(""),
            "secondary": .string(""), "qr": .string(""), "logo": .string(""),
            "autoDate": .bool(true), "showSubtitle": .bool(true), "showFooter": .bool(true),
            "showBadge": .bool(true), "showSecondary": .bool(false), "showQR": .bool(false)
        ]
        self.values = defaults.merging(values) { _, new in new }
    }
    public subscript(_ key: String) -> String {
        get { values[key]?.text ?? "" }
        set { values[key] = .string(newValue) }
    }
    public var isValid: Bool { !self["title"].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !self["fullMedia"].isEmpty }
}
public enum SchoolTime {
    public static func parseISO(_ text: String) -> Date? {
        let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: text) ?? ISO8601DateFormatter().date(from: text)
    }
    public static func today(_ now: Date = Date()) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "Asia/Riyadh")
        f.dateFormat = "yyyy-MM-dd"; return f.string(from: now)
    }
    /// Accept Arabic, Persian and ASCII digits; reject any non-digit content.
    public static func pairingCode(_ input: String) -> String? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count == 6 else { return nil }
        let digits = trimmed.compactMap { $0.wholeNumberValue }
        guard digits.count == 6, digits.allSatisfy({ (0...9).contains($0) }) else { return nil }
        return digits.map(String.init).joined()
    }
}

public struct TransferProgress: Sendable, Equatable {
    public var sent: Int64
    public var total: Int64
    public init(sent: Int64, total: Int64) { self.sent = max(0, sent); self.total = max(0, total) }
    public var fraction: Double? { total > 0 ? min(1, Double(sent) / Double(total)) : nil }
}
public typealias TransferProgressHandler = @Sendable (TransferProgress) -> Void
public protocol ProgressHTTPTransport: HTTPTransport {
    func upload(for request: URLRequest, file: URL, progress: @escaping TransferProgressHandler) async throws -> (Data, HTTPURLResponse)
}
