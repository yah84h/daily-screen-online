// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "SchoolScreenCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [.library(name: "SchoolScreenCore", targets: ["SchoolScreenCore"])],
    targets: [
        .target(name: "SchoolScreenCore", path: "SchoolScreen/Core"),
        .executableTarget(name: "ContractChecks", dependencies: ["SchoolScreenCore"], path: "Checks", exclude: ["check-publish.mjs"])
    ]
)
