import Foundation

struct SolanaRpc {
    let endpoint: URL

    init(_ urlString: String) {
        endpoint = URL(string: urlString)!
    }

    func getSignatureStatus(_ signature: String) async throws -> SignatureStatus {
        let body: [String: Any] = [
            "jsonrpc": "2.0", "id": 1,
            "method": "getSignatureStatuses",
            "params": [[signature], ["searchTransactionHistory": true]]
        ]
        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 10

        let (data, _) = try await URLSession.shared.data(for: req)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        if let error = json["error"] as? [String: Any],
           let msg   = error["message"] as? String {
            throw FernlinkError.rpcError(msg)
        }

        let result = json["result"] as? [String: Any]
        let values = result?["value"] as? [Any]
        let entry  = values?.first.flatMap { $0 as? [String: Any] }

        guard let entry else {
            return SignatureStatus(status: .unknown, slot: 0, blockTime: 0)
        }

        let slot      = entry["slot"] as? UInt64 ?? 0
        let hasError  = entry["err"] != nil && !(entry["err"] is NSNull)
        return SignatureStatus(
            status:    hasError ? .failed : .confirmed,
            slot:      slot,
            blockTime: 0
        )
    }
}

enum FernlinkError: Error {
    case rpcError(String)
    case proofSigningFailed
    case notStarted
}
