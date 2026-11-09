import Foundation
import CoreTransferable
import PhotosUI
import UniformTypeIdentifiers
import ImageIO
import UIKit

struct ImportedMovie: Transferable, Sendable {
    var url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .movie) { received in
            let ext = received.file.pathExtension.isEmpty ? "mov" : received.file.pathExtension.lowercased()
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
            try FileManager.default.copyItem(at: received.file, to: url)
            return ImportedMovie(url: url)
        }
    }
}
struct ImportedImage: Transferable, Sendable {
    var url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .image) { received in
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("image")
            try FileManager.default.copyItem(at: received.file, to: url)
            return ImportedImage(url: url)
        }
    }
}

enum MediaImporter {
    static func animatedGIF(from file: URL) throws -> URL? {
        guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
              CGImageSourceGetType(source) as String? == UTType.gif.identifier,
              CGImageSourceGetCount(source) > 1 else { return nil }
        let output = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("gif")
        try FileManager.default.copyItem(at: file, to: output); return output
    }
    /// Downsample before decoding; a full-size phone photo need not enter memory.
    static func image(from file: URL) throws -> URL {
        guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 3840,
                kCGImageSourceShouldCacheImmediately: true
              ] as CFDictionary) else { throw AppError.message("تعذر فتح الصورة. اختر صورة أخرى.") }
        let photo = UIImage(cgImage: image)
        if [.first, .last, .premultipliedFirst, .premultipliedLast].contains(image.alphaInfo) {
            for side in [3840, 2560, 1920, 1280, 960] {
                guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: side] as CFDictionary),
                      let data = UIImage(cgImage: thumbnail).pngData(), data.count <= 5 * 1024 * 1024 else { continue }
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("png")
                try data.write(to: url, options: .atomic); return url
            }
            throw AppError.message("الصورة الشفافة كبيرة جدًا. اختر نسخة أصغر.")
        }
        for quality in [0.85, 0.72, 0.6, 0.45] {
            if let data = photo.jpegData(compressionQuality: quality), data.count <= 5 * 1024 * 1024 {
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("jpg")
                try data.write(to: url, options: .atomic); return url
            }
        }
        throw AppError.message("الصورة كبيرة جدًا. اختر صورة أصغر.")
    }
}

import AVFoundation
extension MediaImporter {
    static func mp4(from file: URL) async throws -> URL {
        if file.pathExtension.lowercased() == "mp4" { return file }
        let asset = AVURLAsset(url: file)
        guard let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality),
              exporter.supportedFileTypes.contains(.mp4) else {
            throw AppError.message("تعذر تجهيز الفيديو. اختر ملف MP4 آخر.")
        }
        let output = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("mp4")
        exporter.outputURL = output; exporter.outputFileType = .mp4; exporter.shouldOptimizeForNetworkUse = true
        await withTaskCancellationHandler {
            await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                exporter.exportAsynchronously { continuation.resume() }
            }
        } onCancel: { exporter.cancelExport() }
        if Task.isCancelled { try? FileManager.default.removeItem(at: output); throw CancellationError() }
        guard exporter.status == .completed else {
            try? FileManager.default.removeItem(at: output)
            throw AppError.message("تعذر تجهيز الفيديو. حاول اختيار ملف أقصر أو بصيغة MP4.")
        }
        return output
    }
}
