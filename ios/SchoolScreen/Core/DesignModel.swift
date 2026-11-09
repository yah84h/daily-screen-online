import Foundation

public extension JSONValue {
    var flag: Bool? { if case .bool(let v) = self { return v }; return nil }
    var decimal: Double? { if case .number(let v) = self { return v }; return nil }
    var list: [JSONValue]? { if case .array(let v) = self { return v }; return nil }
}
public enum DesignPatch {
    public static func difference(from old: [String: JSONValue], to new: [String: JSONValue]) -> [String: JSONValue] {
        var patch: [String: JSONValue] = [:]
        for key in Set(old.keys).union(new.keys) {
            guard old[key] != new[key] else { continue }
            if let a = old[key]?.object, let b = new[key]?.object { patch[key] = .object(difference(from: a, to: b)) }
            else { patch[key] = new[key] ?? .null }
        }
        return patch
    }
    public static func merge(_ base: [String: JSONValue], patch: [String: JSONValue]) -> [String: JSONValue] {
        var result = base
        for (key, value) in patch {
            if value == .null { result.removeValue(forKey: key) }
            else if let object = value.object { result[key] = .object(merge(result[key]?.object ?? [:], patch: object)) }
            else { result[key] = value }
        }
        return result
    }
}
public struct DesignDocument: Equatable, Sendable {
    public var values: [String: JSONValue]
    public init(_ values: [String: JSONValue]) { self.values = values }
    public func value(_ path: String) -> JSONValue? {
        let parts = path.split(separator: ".").map(String.init)
        var current = JSONValue.object(values)
        for part in parts { guard let next = current.object?[part] else { return nil }; current = next }
        return current
    }
    public mutating func set(_ value: JSONValue, at path: String) {
        func apply(_ object: inout [String: JSONValue], _ parts: ArraySlice<String>) {
            guard let first = parts.first else { return }
            if parts.count == 1 { object[first] = value }
            else { var child = object[first]?.object ?? [:]; apply(&child, parts.dropFirst()); object[first] = .object(child) }
        }
        apply(&values, ArraySlice(path.split(separator: ".").map(String.init)))
    }
    public mutating func applyPalette(_ colors: [String: String]) {
        let old = values["loopAppearance"]?.object ?? [:]
        values["loopAppearance"] = .object(old.merging(colors.mapValues(JSONValue.string)) { _, new in new })
        values["background"] = colors["background"].map(JSONValue.string)
        values["color"] = colors["text"].map(JSONValue.string)
        values["accent"] = colors["accent"].map(JSONValue.string)
    }
    public mutating func setMode(_ mode: String) {
        if values["displayMode"]?.text == "slideshow", values["mediaSlideshow"] == nil, let legacy = values["slideshow"]?.object {
            values["mediaSlideshow"] = .object(legacy)
            values["slideshow"] = .object(legacy.merging(["enabled": .bool(false)]) { _, new in new })
        }
        values["displayMode"] = .string(mode)
    }
}
