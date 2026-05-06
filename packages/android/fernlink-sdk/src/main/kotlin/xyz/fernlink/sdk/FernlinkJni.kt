package xyz.fernlink.sdk

/**
 * JNI bridge to the Rust fernlink-core native library.
 * The .so is loaded once when the class is first referenced.
 */
internal object FernlinkJni {

    init {
        System.loadLibrary("fernlink_core")
    }

    /** Generate a new Ed25519 keypair. Returns 64 bytes: seed(32) + pubkey(32). */
    @JvmStatic external fun generateKeypair(): ByteArray

    /**
     * Derive a keypair from a 32-byte seed.
     * Returns 64 bytes: seed(32) + pubkey(32), where pubkey is deterministically
     * derived from the seed — unlike generateKeypair() which ignores the seed.
     */
    @JvmStatic external fun keypairFromSeed(seed: ByteArray): ByteArray

    /**
     * Sign a VerificationProof.
     * @param keypairSeed  32-byte Ed25519 seed
     * @param txSignature  base58 transaction signature
     * @param statusByte   0=confirmed, 1=failed, 2=unknown
     * @param slot         confirmation slot
     * @param blockTime    block timestamp (0 if unknown)
     * @param errorCode    error code (0 if none)
     * @return JSON string of the signed proof, or null on error
     */
    @JvmStatic external fun signProof(
        keypairSeed: ByteArray,
        txSignature: String,
        statusByte: Byte,
        slot: Long,
        blockTime: Long,
        errorCode: Short,
    ): String?

    /**
     * Verify the Ed25519 signature on a proof JSON string.
     * @return true if signature is valid
     */
    @JvmStatic external fun verifyProof(proofJson: String): Boolean

    /**
     * Evaluate a JSON array of proof strings for consensus.
     * @return JSON: { settled, status?, slot?, blockTime?, proofCount }
     */
    @JvmStatic external fun evaluateProofs(proofsJson: String, minProofs: Int): String?

    /** Compress [data] with the given codec (0=none, 1=lz4, 2=zstd). */
    @JvmStatic external fun compress(codec: Int, data: ByteArray): ByteArray

    /** Decompress [data] with the given codec (0=none, 1=lz4, 2=zstd). */
    @JvmStatic external fun decompress(codec: Int, data: ByteArray): ByteArray
}
