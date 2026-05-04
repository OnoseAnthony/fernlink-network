// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FernlinkSDK",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "FernlinkSDK", targets: ["FernlinkSDK"]),
    ],
    targets: [
        .target(
            name: "FernlinkSDK",
            path: "Sources/FernlinkSDK"
        ),
        .testTarget(
            name: "FernlinkSDKTests",
            dependencies: ["FernlinkSDK"],
            path: "Tests/FernlinkSDKTests"
        ),
    ]
)
