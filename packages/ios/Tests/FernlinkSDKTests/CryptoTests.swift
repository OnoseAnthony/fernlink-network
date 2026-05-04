import XCTest
@testable import FernlinkSDK

final class CryptoTests: XCTestCase {

    func testSignAndVerifyRoundtrip() throws {
        let kp    = FernlinkKeypair()
        let proof = try kp.signProof(txSignature: "abc123", status: .confirmed, slot: 100, blockTime: 0, errorCode: 0)
        XCTAssertTrue(verifyProof(proof))
    }

    func testTamperedProofFails() throws {
        let kp   = FernlinkKeypair()
        var proof = try kp.signProof(txSignature: "abc123", status: .confirmed, slot: 100, blockTime: 0, errorCode: 0)
        // Tamper with status after signing
        proof = VerificationProof(
            txSignature: proof.txSignature, status: .failed,
            slot: proof.slot, blockTime: proof.blockTime,
            errorCode: proof.errorCode, verifierPublicKey: proof.verifierPublicKey,
            signature: proof.signature
        )
        XCTAssertFalse(verifyProof(proof))
    }

    func testDeterministicKeypairFromSeed() throws {
        let seed = Data(repeating: 0xAB, count: 32)
        let kp1  = try FernlinkKeypair(seed: seed)
        let kp2  = try FernlinkKeypair(seed: seed)
        XCTAssertEqual(kp1.publicKeyBytes, kp2.publicKeyBytes)
    }

    func testFragmentRoundtrip() {
        let data  = Data(repeating: 0xFF, count: 1500)
        let frags = BleFragmentation.fragment(data)
        XCTAssertEqual(frags.count, 3) // 1500 / 510 = 2 full + 1 partial

        let r = BleFragmentation.Reassembler()
        var result: Data?
        for frag in frags { result = r.feed(frag) }
        XCTAssertEqual(result, data)
    }
}
