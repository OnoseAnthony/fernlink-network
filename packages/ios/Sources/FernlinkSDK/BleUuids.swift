import CoreBluetooth

// fe4e = valid hex encoding of "FeN" (Fernlink). Must match Android, Rust, and TypeScript layers.
enum BleUuids {
    static let fernlinkService = CBUUID(string: "FE4E0000-0000-1000-8000-00805F9B34FB")
    static let charRequest     = CBUUID(string: "FE4E0001-0000-1000-8000-00805F9B34FB")
    static let charProof       = CBUUID(string: "FE4E0002-0000-1000-8000-00805F9B34FB")
    static let charStatus      = CBUUID(string: "FE4E0003-0000-1000-8000-00805F9B34FB")
    static let descriptorCCC   = CBUUID(string: "2902")

    static let mtu = 512
}
