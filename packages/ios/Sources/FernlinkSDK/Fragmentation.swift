import Foundation

// 2-byte header [index: UInt8, total: UInt8] — identical to Android, Rust, and TypeScript layers.
enum BleFragmentation {
    private static let headerSize = 2
    private static let maxPayload = BleUuids.mtu - headerSize

    static func fragment(_ data: Data) -> [Data] {
        var chunks: [Data] = []
        var offset = 0
        while offset < data.count {
            let end = min(offset + maxPayload, data.count)
            chunks.append(data[offset ..< end])
            offset = end
        }
        let total = UInt8(chunks.count)
        return chunks.enumerated().map { i, chunk in
            var frag = Data([UInt8(i), total])
            frag.append(chunk)
            return frag
        }
    }

    final class Reassembler {
        private var slots: [Data?] = []
        private var received = 0

        func feed(_ frag: Data) -> Data? {
            guard frag.count >= headerSize else { return nil }
            let index = Int(frag[0])
            let total = Int(frag[1])
            let payload = frag.dropFirst(headerSize)

            if slots.isEmpty { slots = [Data?](repeating: nil, count: total) }
            guard index < slots.count, slots[index] == nil else { return nil }

            slots[index] = Data(payload)
            received += 1

            guard received == slots.count else { return nil }
            let complete = slots.compactMap { $0 }.reduce(Data(), +)
            reset()
            return complete
        }

        func reset() { slots = []; received = 0 }
    }
}
