import Foundation
import Security

struct KeychainSessionStorage: SessionStorage {
    private let service: String
    init(namespace: String? = nil) {
        service = "school.daily-screen.session" + (namespace.map { "." + $0 } ?? "")
    }
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service, kSecAttrAccount as String: "supabase"]
    }
    func load() throws -> Session? {
        var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw keychainError }
        return try JSONDecoder().decode(Session.self, from: data)
    }
    func save(_ session: Session) throws {
        let data = try JSONEncoder().encode(session)
        let update: [String: Any] = [kSecValueData as String: data,
                                    kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(update) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw keychainError }
    }
    func clear() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw keychainError }
    }
    private var keychainError: AppError { .message("تعذر الوصول إلى جلسة الدخول الآمنة. افتح قفل الجهاز ثم حاول مجددًا.") }
}
