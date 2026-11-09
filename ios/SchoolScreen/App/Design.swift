import SwiftUI

enum Brand {
    static let blue = Color(red: 0.19, green: 0.45, blue: 0.88)
    static let ink = Color.primary
    static let background = Color(uiColor: .systemGroupedBackground)
}
struct BrandMark: View {
    var body: some View {
        Image(systemName: "tv").font(.system(size: 32, weight: .semibold))
            .foregroundStyle(.white).frame(width: 76, height: 76)
            .background(Brand.blue.gradient, in: RoundedRectangle(cornerRadius: 24))
            .accessibilityHidden(true)
    }
}
struct PrimaryButton: View {
    let title: String
    let icon: String
    var busy = false
    var disabled = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if busy { ProgressView().tint(.white) }
                else { Image(systemName: icon) }
                Text(title).fontWeight(.semibold)
            }.frame(maxWidth: .infinity).frame(minHeight: 54)
        }
        .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: 17))
        .disabled(busy || disabled)
    }
}
struct InfoNote: View {
    let text: String
    var icon = "info.circle"
    var body: some View {
        Label(text, systemImage: icon).font(.subheadline).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
struct EmptyState: View {
    let title: String
    let detail: String
    let icon: String
    var body: some View {
        ContentUnavailableView(title, systemImage: icon, description: Text(detail))
    }
}
extension Color {
    init(hex: String, fallback: Color = Brand.blue) {
        let raw = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard raw.count == 6, let value = UInt64(raw, radix: 16) else { self = fallback; return }
        self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
}
