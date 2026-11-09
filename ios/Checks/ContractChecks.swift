import Foundation
import SchoolScreenCore

@main
struct ContractChecks {
    static func main() async throws {
        if let index = CommandLine.arguments.firstIndex(of: "--local-server"), CommandLine.arguments.count > index + 1 {
            try await testRealLocalServer(CommandLine.arguments[index + 1]); return
        }
        testDesignPatchPreservesConcurrentNestedFields()
        testPalettePreservesGeometryAndFutureFields()
        testLegacyPlaylistMigration()
        testProgressBounds()
        testFractionalISODate()
        try testLocalConfigurationRejectsCloudHosts()
        testArabicAndPersianPairingCodes()
        try testRiyadhDateRollsOverBeforeUTC()
        try testEditingPreservesFieldsUnknownToTheApp()
        try testNoSecretOrPlainHTTPConfiguration()
        testEmptyTitleNeedsMedia()
        try testPairedDeviceStatusAcceptsPostgresFractionalTimestamp()
        try await testPublishUsesAtomicRPCAndStableRequestID()
        try await testPairingCallsExistingRPCWithNormalizedDigits()
        try await testLatestPostUsesRiyadhDateAndTieBreakOrder()
        try await testRefreshPersistsRotatedSessionBeforeRequest()
        testServerErrorsDoNotExposeInternalDetails()
        try await testEmailErrorSurvivesResolverOutage()
        try await testSuccessfulEmailSkipsUsernameResolver()
        try await testEmailShapedUsernameCanStillResolve()
        try await testUsernameOutageHasSpecificError()
        print("PASS: 21 native Swift contract checks")
    }

    static func testArabicAndPersianPairingCodes() {
        XCTAssertEqual(SchoolTime.pairingCode("١٢٣٤٥٦"), "123456")
        XCTAssertEqual(SchoolTime.pairingCode("۱۲۳۴۵۶"), "123456")
        XCTAssertEqual(SchoolTime.pairingCode(" 012345 "), "012345")
        XCTAssertNil(SchoolTime.pairingCode("12-456"))
        XCTAssertNil(SchoolTime.pairingCode("12345"))
        XCTAssertNil(SchoolTime.pairingCode("1234567"))
    }
    static func testRiyadhDateRollsOverBeforeUTC() throws {
        let date = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-11-09T21:05:00Z"))
        XCTAssertEqual(SchoolTime.today(date), "2026-11-10")
    }
    static func testEditingPreservesFieldsUnknownToTheApp() throws {
        let values = try JSONDecoder().decode([String: JSONValue].self, from: Data(#"{"title":"Old","futureField":{"x":[true,3,null]},"showQR":true,"qr":"https://example.com/qr.png"}"#.utf8))
        var content = Announcement(values: values); content["title"] = "New"
        XCTAssertEqual(content.values["futureField"], values["futureField"])
        XCTAssertEqual(content.values["showQR"], .bool(true))
        XCTAssertEqual(content["qr"], "https://example.com/qr.png")
        let encoded = try JSONEncoder().encode(content.values)
        XCTAssertEqual(try JSONDecoder().decode([String: JSONValue].self, from: encoded), content.values)
    }
    static func testNoSecretOrPlainHTTPConfiguration() throws {
        let url = try XCTUnwrap(URL(string: "https://example.supabase.co"))
        XCTAssertThrowsError(try BackendConfiguration(siteURL: url, supabaseURL: url, anonKey: "sb_secret_not-for-clients").validate())
        XCTAssertThrowsError(try BackendConfiguration(siteURL: URL(string: "http://example.com")!, supabaseURL: url, anonKey: "public").validate())
        XCTAssertNoThrow(try BackendConfiguration(siteURL: url, supabaseURL: url, anonKey: "sb_publishable_public").validate())
    }
    static func testEmptyTitleNeedsMedia() {
        var a = Announcement(); a["title"] = "  \n"
        XCTAssertFalse(a.isValid)
        a["fullMedia"] = "https://example.com/video.mp4"
        XCTAssertTrue(a.isValid)
    }
    static func testPairedDeviceStatusAcceptsPostgresFractionalTimestamp() throws {
        let device = try JSONDecoder().decode(ScreenDevice.self, from: Data(#"{"code":"123456","screen_id":"screen","last_seen_at":"2026-11-09T10:00:00.123456+00:00"}"#.utf8))
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-11-09T10:00:30Z"))
        XCTAssertTrue(device.isOnline(now: now))
        XCTAssertFalse(device.isOnline(now: now.addingTimeInterval(100)))
    }
    static func testPublishUsesAtomicRPCAndStableRequestID() async throws {
        let transport = MockTransport(replies: [#"{"id":"receipt","publish_at":"2026-11-09"}"#])
        let api = try makeAPI(transport)
        var content = Announcement(); content["title"] = "إعلان"
        let id = UUID()
        _ = try await api.publish(screenID: "screen-1", announcement: content, mode: "daily", requestID: id)
        let requests = await transport.requests
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests[0].url?.path, "/rest/v1/rpc/publish_from_iphone")
        XCTAssertEqual(requests[0].value(forHTTPHeaderField: "Authorization"), "Bearer access")
        let body = try JSONDecoder().decode([String: JSONValue].self, from: XCTUnwrap(requests[0].httpBody))
        XCTAssertEqual(body["p_request_id"], .string(id.uuidString))
        XCTAssertEqual(body["p_content"]?.object?["title"], .string("إعلان"))
    }
    static func testPairingCallsExistingRPCWithNormalizedDigits() async throws {
        let transport = MockTransport(replies: ["null"])
        let api = try makeAPI(transport)
        try await api.pair(code: "١٢٣٤٥٦", screenID: "school", label: "الممر")
        let captured = await transport.snapshot()
        let request = try XCTUnwrap(captured.first)
        let body = try JSONDecoder().decode([String: JSONValue].self, from: XCTUnwrap(request.httpBody))
        XCTAssertEqual(request.url?.path, "/rest/v1/rpc/pair_screen")
        XCTAssertEqual(body["p_code"], .string("123456"))
    }
    static func testLatestPostUsesRiyadhDateAndTieBreakOrder() async throws {
        let transport = MockTransport(replies: ["[]"])
        _ = try await makeAPI(transport).latestPost(screenID: "a&b")
        let captured = await transport.snapshot()
        let request = try XCTUnwrap(captured.first)
        let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!
        XCTAssertEqual(query.first { $0.name == "screen_id" }?.value, "eq.a&b")
        XCTAssertEqual(query.first { $0.name == "publish_at" }?.value, "lte.\(SchoolTime.today())")
        XCTAssertEqual(query.first { $0.name == "order" }?.value, "publish_at.desc,created_at.desc")
    }
    static func testRefreshPersistsRotatedSessionBeforeRequest() async throws {
        let storage = MemoryStorage(Session(accessToken: "old", refreshToken: "refresh"))
        let transport = MockTransport(replies: [#"{"access_token":"new","refresh_token":"rotated","expires_in":3600}"#, "[]"])
        let api = try makeAPI(transport, storage: storage)
        _ = try await api.screens()
        let requests = await transport.requests
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(requests[0].url?.path, "/auth/v1/token")
        XCTAssertEqual(requests[1].value(forHTTPHeaderField: "Authorization"), "Bearer new")
        XCTAssertEqual(try storage.load()?.refreshToken, "rotated")
    }
    static func testServerErrorsDoNotExposeInternalDetails() {
        XCTAssertEqual(AppError.http(503, "internal SQL details").errorDescription, "الخدمة غير متاحة الآن. حاول بعد قليل.")
    }
    static func testEmailErrorSurvivesResolverOutage() async throws {
        let transport = MockTransport(replies: [#"{"code":"invalid_credentials","msg":"Invalid login credentials"}"#, #"{"error":"Server unavailable"}"#], statuses: [400, 503])
        do {
            _ = try await makeAPI(transport).signIn(username: "teacher@example.com", password: "test-only")
            preconditionFailure("Expected email rejection")
        } catch let error as AppError {
            XCTAssertEqual(error, .http(400, "Invalid login credentials"))
            XCTAssertTrue(error.localizedDescription.contains("البريد أو كلمة المرور"))
        }
        let requests = await transport.snapshot()
        XCTAssertEqual(requests.count, 2)
    }
    static func testSuccessfulEmailSkipsUsernameResolver() async throws {
        let transport = MockTransport(replies: [#"{"access_token":"email","refresh_token":"r","expires_in":3600}"#, staffFixture])
        _ = try await makeAPI(transport).signIn(username: " teacher@example.com ", password: "test-only")
        let requests = await transport.snapshot()
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(requests[0].url?.host, "db.example")
        XCTAssertEqual(requests[1].url?.path, "/rest/v1/rpc/current_staff")
    }
    static func testEmailShapedUsernameCanStillResolve() async throws {
        let transport = MockTransport(replies: [#"{"msg":"Invalid login credentials"}"#, #"{"access_token":"resolved","refresh_token":"r","expires_in":3600}"#, staffFixture], statuses: [400, 200, 200])
        _ = try await makeAPI(transport).signIn(username: "username@example.com", password: "test-only")
        let requests = await transport.snapshot()
        XCTAssertEqual(requests.count, 3)
        XCTAssertEqual(requests[1].url?.host, "school.example")
        XCTAssertEqual(requests[2].value(forHTTPHeaderField: "Authorization"), "Bearer resolved")
    }
    static func testUsernameOutageHasSpecificError() async throws {
        let transport = MockTransport(replies: [#"{"error":"Service unavailable"}"#], statuses: [503])
        do {
            _ = try await makeAPI(transport).signIn(username: "teacher", password: "test-only")
            preconditionFailure("Expected resolver error")
        } catch let error as AppError {
            XCTAssertTrue(error.localizedDescription.contains("باسم المستخدم"))
        }
    }
    private static let staffFixture = #"{"id":"teacher","username":"Teacher","permissions":{"admin":true,"daily":true,"news":true},"active":true}"#
    static func testDesignPatchPreservesConcurrentNestedFields() {
        let old: [String: JSONValue] = ["loopAppearance": .object(["background": .string("#ffffff"), "future": .number(7)]), "imageX": .number(6)]
        var design = DesignDocument(old); design.set(.string("#123456"), at: "loopAppearance.background")
        let patch = DesignPatch.difference(from: old, to: design.values)
        XCTAssertEqual(patch, ["loopAppearance": .object(["background": .string("#123456")])])
        var concurrent = old; concurrent["loopAppearance"] = .object(["background": .string("#ffffff"), "future": .number(8), "added": .bool(true)])
        let merged = DesignPatch.merge(concurrent, patch: patch)
        XCTAssertEqual(merged["loopAppearance"]?.object?["future"], .number(8))
        XCTAssertEqual(merged["loopAppearance"]?.object?["added"], .bool(true))
    }
    static func testPalettePreservesGeometryAndFutureFields() {
        var design = DesignDocument(["imageX": .number(6), "backgroundImage": .string("/photo.jpg"), "loopAppearance": .object(["future": .bool(true)])])
        design.applyPalette(["background": "#111111", "text": "#eeeeee", "accent": "#123456"])
        XCTAssertEqual(design.values["color"], .string("#eeeeee")); XCTAssertEqual(design.values["imageX"], .number(6))
        XCTAssertEqual(design.values["backgroundImage"], .string("/photo.jpg")); XCTAssertEqual(design.value("loopAppearance.future"), .bool(true))
    }
    static func testLegacyPlaylistMigration() {
        let original: JSONValue = .object(["enabled": .bool(true), "images": .array([.object(["id": .string("a"), "url": .string("/image.jpg")])])])
        var design = DesignDocument(["displayMode": .string("slideshow"), "slideshow": original])
        design.setMode("loop")
        XCTAssertEqual(design.values["mediaSlideshow"], original)
        XCTAssertEqual(design.value("slideshow.enabled"), .bool(false))
    }
    static func testProgressBounds() {
        XCTAssertNil(TransferProgress(sent: 0, total: 0).fraction)
        XCTAssertEqual(TransferProgress(sent: 50, total: 100).fraction, 0.5)
        XCTAssertEqual(TransferProgress(sent: 200, total: 100).fraction, 1)
    }
    static func testFractionalISODate() {
        XCTAssertTrue(SchoolTime.parseISO("2026-11-09T10:00:00.123Z") != nil)
        XCTAssertTrue(SchoolTime.parseISO("2026-11-09T10:00:00Z") != nil)
    }
    static func testLocalConfigurationRejectsCloudHosts() throws {
        for address in ["https://schoolpodcast.netlify.app", "http://8.8.8.8:8080", "http://a.192.168.1.1", "http://192.168.1.1/admin", "http://user:pass@192.168.1.1:8080"] {
            XCTAssertThrowsError(try BackendConfiguration.localServer(address))
        }
        for address in ["192.168.8.31:8080", "http://10.0.0.2:8080", "http://172.16.0.2:8080", "http://school-mac.local:8080", "http://127.0.0.1:28080"] {
            XCTAssertTrue(try BackendConfiguration.localServer(address).isLocal)
        }
    }
    static func testRealLocalServer(_ address: String) async throws {
        let config = try BackendConfiguration.localServer(address)
        let storage = MemoryStorage(nil)
        let observed = ObservedLocalTransport(origin: config.siteURL)
        let api = try APIClient(configuration: config, storage: storage, transport: observed)
        try await api.checkLocalServer()
        let user = try await api.signIn(username: "Archo", password: "Arc@2027")
        XCTAssertTrue(user.canPublish)
        XCTAssertEqual(try await api.currentStaff().id, user.id)
        let screens = try await api.screens()
        let screen = try XCTUnwrap(screens.first)
        var content = Announcement(); content["title"] = "Native LAN integration"
        content["image"] = config.siteURL.appendingPathComponent("workspace.jpg").absoluteString
        content.values["futureField"] = .object(["keep": .bool(true)])
        try await api.saveDraft(screenID: screen.id, announcement: content)
        let reloaded = try await api.screens()
        XCTAssertEqual(reloaded.first?.draft?["futureField"], content.values["futureField"])
        XCTAssertEqual(reloaded.first?.draft?["image"]?.text, content["image"])
        let id = UUID()
        let first = try await api.publish(screenID: screen.id, announcement: content, mode: "daily", requestID: id)
        let again = try await api.publish(screenID: screen.id, announcement: content, mode: "daily", requestID: id)
        XCTAssertEqual(first.id, again.id)
        XCTAssertEqual(try await api.latestPost(screenID: screen.id)?.id, first.id)
        var req = URLRequest(url: config.siteURL.appendingPathComponent("local/rpc"))
        req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = Data(#"{"name":"request_pairing","args":{},"options":"?pair=1"}"#.utf8)
        let (pairData, _) = try await URLSession.shared.data(for: req)
        let pair = try JSONDecoder().decode([String: JSONValue].self, from: pairData)
        let code = try XCTUnwrap(pair["data"]?.object?["code"]?.text)
        try await api.pair(code: code, screenID: screen.id, label: "Native test TV")
        XCTAssertTrue(try await api.devices(screenID: screen.id).contains { $0.label == "Native test TV" })
        let fixture = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("public/workspace.jpg")
        let image = try Data(contentsOf: fixture)
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("jpg")
        try image.write(to: file); defer { try? FileManager.default.removeItem(at: file) }
        let uploadEvents = ProgressRecorder()
        let uploaded = try await api.upload(file: file, mime: "image/jpeg", extension: "jpg", progress: { value in uploadEvents.record(value) })
        XCTAssertTrue(!uploadEvents.values.isEmpty)
        XCTAssertEqual(uploadEvents.values.last?.sent, Int64(image.count))
        XCTAssertEqual(uploadEvents.values.last?.total, Int64(image.count))
        let (readback, _) = try await URLSession.shared.data(from: uploaded)
        XCTAssertEqual(readback, image)
        try await api.saveNews(screenID: screen.id, settings: ["enabled": .bool(true), "items": .array([.object(["id": .string("test"), "text": .string("LAN announcement"), "enabled": .bool(true)])])])
        try await api.saveTemplate(screenID: screen.id, patch: ["loopAppearance": .object(["futureField": .number(42)])])
        try await api.saveTemplate(screenID: screen.id, patch: ["displayMode": .string("loop"), "background": .string("#10275a"), "color": .string("#f1f6ff"), "backgroundImage": .string(uploaded.absoluteString), "loopAppearance": .object(["background": .string("#10275a"), "text": .string("#f1f6ff"), "widget": .string("#1b3972"), "muted": .string("#adbedc"), "accent": .string("#91b9ff"), "border": .string("#3b5685"), "meterFill": .string("#91b9ff"), "meterTrack": .string("#3b5685")]), "recognition": .object(["enabled": .bool(true), "title": .string("Native stars"), "students": .array([.object(["id": .string("student"), "name": .string("Test student"), "achievement": .string("Excellent"), "photo": .string(uploaded.absoluteString)])])]), "centerSlideshow": .object(["enabled": .bool(true), "images": .array([.object(["id": .string("slide"), "url": .string(uploaded.absoluteString)])])])])
        let designed = try XCTUnwrap(try await api.screens().first)
        XCTAssertEqual(designed.template["background"], .string("#10275a"))
        XCTAssertEqual(designed.template["loopAppearance"]?.object?["futureField"], .number(42))
        XCTAssertEqual(designed.template["news"]?.object?["items"]?.list?.first?.object?["text"], .string("LAN announcement"))
        XCTAssertEqual(designed.template["recognition"]?.object?["students"]?.list?.first?.object?["photo"], .string(uploaded.absoluteString))
        let scheduleID = UUID()
        let scheduled = try await api.scheduleLocal(screenID: screen.id, content: content, date: "2099-11-09", requestID: scheduleID)
        _ = try await api.scheduleLocal(screenID: screen.id, content: content, date: "2099-11-09", requestID: scheduleID)
        XCTAssertEqual(scheduled.publish_at, "2099-11-09")
        try await api.localMutate(table: "presets", action: "insert", values: ["name": .string("Native preset"), "content": .object(content.values)])
        let presets = try await api.localRecords(table: "presets", filters: [.array([.string("name"), .string("eq"), .string("Native preset")])])
        XCTAssertEqual(presets.count, 1)
        let presetID = try XCTUnwrap(presets.first?.object?["id"]?.text)
        try await api.localMutate(table: "presets", action: "delete", filters: [.array([.string("id"), .string("eq"), .string(presetID)])])
        let teacherResult = try await api.manageLocalStaff(["action": .string("create"), "username": .string("native.teacher"), "password": .string("NativeTeacher-128"), "permissions": .object(["daily": .bool(true)])])
        let teacherID = try XCTUnwrap(teacherResult.object?["id"]?.text)
        let teacher = try APIClient(configuration: config, storage: MemoryStorage(nil), transport: observed)
        _ = try await teacher.signIn(username: "native.teacher", password: "NativeTeacher-128")
        do { try await teacher.saveTemplate(screenID: screen.id, patch: ["background": .string("#ffffff")]); preconditionFailure("Daily teacher changed design") }
        catch { XCTAssertTrue(error.localizedDescription.contains("صلاحية")) }
        _ = try await api.manageLocalStaff(["action": .string("update"), "id": .string(teacherID), "active": .bool(false)])
        do { _ = try await teacher.currentStaff(); preconditionFailure("Disabled user retained access") } catch AppError.sessionExpired {}
        let restored = try APIClient(configuration: config, storage: storage, transport: observed)
        XCTAssertEqual(try await restored.currentStaff().id, user.id)
        await api.signOut()
        XCTAssertNil(try storage.load())
        do { _ = try await restored.currentStaff(); preconditionFailure("Logged-out server session remained valid") }
        catch AppError.sessionExpired {}
        print("PASS: real local server — login, cookie restore, actual upload progress, media, TV pairing, colors/wallpaper, slides, recognition, scheduling, presets, accounts/role enforcement, publication retry and logout")
    }
    private static func makeAPI(_ transport: MockTransport, storage: MemoryStorage? = nil) throws -> APIClient {
        let config = BackendConfiguration(siteURL: URL(string: "https://school.example")!, supabaseURL: URL(string: "https://db.example")!, anonKey: "public")
        return try APIClient(configuration: config,
                             storage: storage ?? MemoryStorage(Session(accessToken: "access", refreshToken: "refresh", expiresAt: Date().addingTimeInterval(3600))),
                             transport: transport)
    }
}

private final class MemoryStorage: SessionStorage, @unchecked Sendable {
    private let lock = NSLock()
    private var value: Session?
    init(_ value: Session?) { self.value = value }
    func load() throws -> Session? { lock.lock(); defer { lock.unlock() }; return value }
    func save(_ session: Session) throws { lock.lock(); defer { lock.unlock() }; value = session }
    func clear() throws { lock.lock(); defer { lock.unlock() }; value = nil }
}
private actor MockTransport: HTTPTransport {
    var requests: [URLRequest] = []
    var replies: [String]
    var statuses: [Int]
    init(replies: [String], statuses: [Int] = []) { self.replies = replies; self.statuses = statuses }
    func snapshot() -> [URLRequest] { requests }
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        guard !replies.isEmpty else { throw AppError.message("Unexpected request") }
        let status = statuses.isEmpty ? 200 : statuses.removeFirst()
        return (Data(replies.removeFirst().utf8), HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!)
    }
    func upload(for request: URLRequest, file: URL) async throws -> (Data, HTTPURLResponse) { try await data(for: request) }
}

private func XCTAssertEqual<T: Equatable>(_ actual: T, _ expected: T, file: StaticString = #file, line: UInt = #line) {
    precondition(actual == expected, "Expected \(expected), got \(actual)", file: file, line: line)
}
private func XCTAssertTrue(_ value: Bool) { precondition(value) }
private func XCTAssertFalse(_ value: Bool) { precondition(!value) }
private func XCTAssertNil<T>(_ value: T?) { precondition(value == nil) }
private func XCTUnwrap<T>(_ value: T?) throws -> T {
    guard let value else { throw AppError.message("Expected a non-nil value") }; return value
}
private func XCTAssertThrowsError<T>(_ action: @autoclosure () throws -> T) {
    do { _ = try action() } catch { return }; preconditionFailure("Expected error")
}
private func XCTAssertNoThrow<T>(_ action: @autoclosure () throws -> T) {
    do { _ = try action() } catch { preconditionFailure("Unexpected error: \(error)") }
}

private actor ObservedLocalTransport: ProgressHTTPTransport {
    let origin: URL
    let transport: URLSessionTransport
    init(origin: URL) { self.origin = origin; transport = URLSessionTransport(localOrigin: origin) }
    private func validate(_ request: URLRequest) {
        precondition(request.url?.host == origin.host && request.url?.port == origin.port)
        precondition(request.url?.path.hasPrefix("/local/") == true)
        precondition(request.value(forHTTPHeaderField: "apikey") == nil)
        precondition(request.value(forHTTPHeaderField: "Authorization") == nil)
    }
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        validate(request); return try await transport.data(for: request)
    }
    func upload(for request: URLRequest, file: URL) async throws -> (Data, HTTPURLResponse) {
        validate(request); return try await transport.upload(for: request, file: file)
    }
    func upload(for request: URLRequest, file: URL, progress: @escaping TransferProgressHandler) async throws -> (Data, HTTPURLResponse) {
        validate(request); return try await transport.upload(for: request, file: file, progress: progress)
    }
}

private final class ProgressRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var events: [TransferProgress] = []
    func record(_ value: TransferProgress) { lock.lock(); defer { lock.unlock() }; events.append(value) }
    var values: [TransferProgress] { lock.lock(); defer { lock.unlock() }; return events }
}
