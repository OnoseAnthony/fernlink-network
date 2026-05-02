package xyz.fernlink.sdk

import kotlinx.serialization.Serializable

enum class TxStatus { CONFIRMED, FAILED, UNKNOWN }

enum class Commitment { PROCESSED, CONFIRMED, FINALIZED }

@Serializable
data class VerificationProof(
    val messageId: String,
    val txSignature: String,
    val status: String,
    val slot: Long,
    val blockTime: Long,
    val errorCode: Int,
    val verifierPublicKey: String,
    val signature: String,
    val timestampMs: Long,
)

@Serializable
data class ConsensusResult(
    val settled: Boolean,
    val status: String? = null,
    val slot: Long? = null,
    val blockTime: Long? = null,
    val proofCount: Int,
)

data class FernlinkClientConfig(
    val rpcEndpoint: String,
    val minProofs: Int = 2,
    /** Optional 32-byte Ed25519 seed. Generated automatically if null. */
    val keypairSeed: ByteArray? = null,
)
