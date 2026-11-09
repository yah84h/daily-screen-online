import SwiftUI
import PhotosUI

struct UploadedMedia { let url: URL; let isVideo: Bool }
@MainActor @Observable
final class MediaUploadController {
    var busy = false
    var phase = ""
    var progress: TransferProgress?
    var error: String?
    private var task: Task<Void, Never>?
    private var generation = UUID()
    var fileIndex = 0
    var fileCount = 0
    private var currentFile = UUID()
    func start(_ item: PhotosPickerItem, model: AppModel, preserveAnimation: Bool = false, completion: @escaping @MainActor (UploadedMedia) -> Void) { startBatch([item], model: model, preserveAnimation: preserveAnimation, completion: completion) }
    func startBatch(_ items: [PhotosPickerItem], model: AppModel, preserveAnimation: Bool = false, completion: @escaping @MainActor (UploadedMedia) -> Void) {
        cancel(); let id = UUID(); generation = id
        busy = true; error = nil; progress = nil; fileCount = items.count
        task = Task {
            defer { if generation == id { busy = false; task = nil } }
            var failures: [String] = []
            for (index, item) in items.enumerated() {
                if Task.isCancelled || generation != id { break }
                fileIndex = index + 1; currentFile = UUID(); progress = nil
                do { let media = try await perform(item, model: model, id: id, fileID: currentFile, preserveAnimation: preserveAnimation); try Task.checkCancellation(); completion(media) }
                catch is CancellationError { break }
                catch { failures.append(model.readable(error)) }
            }
            if generation == id, !failures.isEmpty { error = failures.joined(separator: "\n") }
        }
    }
    private func perform(_ item: PhotosPickerItem, model: AppModel, id: UUID, fileID: UUID, preserveAnimation: Bool) async throws -> UploadedMedia {
        var temporary: [URL] = []
        defer { temporary.forEach { try? FileManager.default.removeItem(at: $0) } }
        guard !model.demo, let api = model.api else { throw AppError.message("رفع الملفات متاح بعد تسجيل الدخول إلى الخادم.") }
        phase = "جارٍ قراءة الملف…"
        let isVideo = item.supportedContentTypes.contains { $0.conforms(to: .movie) }
        let file: URL
        if isVideo {
            guard let movie = try await item.loadTransferable(type: ImportedMovie.self) else { throw AppError.message("تعذر قراءة الفيديو.") }
            temporary.append(movie.url); phase = "جارٍ تجهيز الفيديو…"
            file = try await MediaImporter.mp4(from: movie.url); temporary.append(file)
        } else {
            guard let image = try await item.loadTransferable(type: ImportedImage.self) else { throw AppError.message("تعذر قراءة الصورة.") }
            temporary.append(image.url); phase = "جارٍ تجهيز الصورة…"
            file = try await Task.detached { if preserveAnimation, let animated = try MediaImporter.animatedGIF(from: image.url) { return animated }; return try MediaImporter.image(from: image.url) }.value; temporary.append(file)
        }
        try Task.checkCancellation(); phase = "جارٍ رفع الملف…"
        let extensionName = isVideo ? "mp4" : file.pathExtension
        let mime = isVideo ? "video/mp4" : extensionName == "gif" ? "image/gif" : extensionName == "png" ? "image/png" : "image/jpeg"
        let url = try await api.upload(file: file, mime: mime, extension: extensionName) { [weak self] value in
            Task { @MainActor [weak self] in
                guard let self, self.generation == id, self.currentFile == fileID, self.busy else { return }
                self.progress = value
                if value.fraction == 1 { self.phase = "اكتمل الإرسال، جارٍ تأكيد الحفظ…" }
            }
        }
        try Task.checkCancellation(); return UploadedMedia(url: url, isVideo: isVideo)
    }
    func cancel() { generation = UUID(); task?.cancel(); task = nil; busy = false; progress = nil }
}
struct UploadProgressCard: View {
    var upload: MediaUploadController
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if upload.fileCount > 1 { Text("الملف \(upload.fileIndex) من \(upload.fileCount)").font(.caption).foregroundStyle(.secondary) }
            HStack {
                Text(upload.phase).font(.subheadline.bold())
                Spacer()
                if let fraction = upload.progress?.fraction { Text(fraction, format: .percent.precision(.fractionLength(0))).monospacedDigit() }
            }
            if let fraction = upload.progress?.fraction { ProgressView(value: fraction).accessibilityLabel("تقدم الرفع") }
            else { ProgressView().accessibilityLabel(upload.phase) }
            if let progress = upload.progress, progress.total > 0 {
                Text(ByteCountFormatter.string(fromByteCount: progress.sent, countStyle: .file) + " / " + ByteCountFormatter.string(fromByteCount: progress.total, countStyle: .file))
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            Button("إلغاء الرفع", role: .cancel) { upload.cancel() }.frame(minHeight: 44)
        }.padding(.vertical, 8)
    }
}
struct PhotoUploadRow: View {
    @Environment(AppModel.self) private var model
    let title: String
    @Binding var url: String
    var onBusy: (Bool) -> Void = { _ in }
    @State private var selection: PhotosPickerItem?
    @State private var upload = MediaUploadController()
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if upload.busy { UploadProgressCard(upload: upload) }
            else {
                if !url.isEmpty {
                    AsyncImage(url: URL(string: url)) { image in image.resizable().scaledToFit() }
                    placeholder: { ProgressView() }.frame(maxHeight: 150).clipShape(RoundedRectangle(cornerRadius: 12))
                    Button("إزالة الصورة", role: .destructive) { url = "" }
                }
                PhotosPicker(selection: $selection, matching: .images, preferredItemEncoding: .compatible) { Label(title, systemImage: "photo.badge.plus").frame(minHeight: 44) }
            }
            if let error = upload.error { Text(error).font(.footnote).foregroundStyle(.red) }
        }
        .onChange(of: selection) { _, item in
            if let item { upload.start(item, model: model) { media in url = media.url.absoluteString }; selection = nil }
        }
        .onChange(of: upload.busy) { _, busy in onBusy(busy) }
        .navigationBarBackButtonHidden(upload.busy)
        .onDisappear { upload.cancel(); onBusy(false) }
    }
}
