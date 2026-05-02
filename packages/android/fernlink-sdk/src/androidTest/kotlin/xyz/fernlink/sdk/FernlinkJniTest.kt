package xyz.fernlink.sdk

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented integration test that exercises the full JNI proof round-trip
 * on a real Android device or emulator.
 *
 * Covers: generateKeypair → signProof → verifyProof → evaluateProofs
 */
@RunWith(AndroidJUnit4::class)
class FernlinkJniTest {

    @Test
    fun generateKeypair_returns64Bytes() {
        val kp = FernlinkJni.generateKeypair()
        assertEquals(64, kp.size)
    }

    @Test
    fun signProof_returnsValidJson() {
        val kp   = FernlinkJni.generateKeypair()
        val seed = kp.sliceArray(0..31)
        val json = FernlinkJni.signProof(
            keypairSeed = seed,
            txSignature = "5wHu1a8pgZFo9t5WNpV3BKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQ",
            statusByte  = 0,
            slot        = 123456789L,
            blockTime   = 1700000000L,
            errorCode   = 0,
        )
        assertNotNull("signProof returned null", json)
        val obj = JSONObject(json!!)
        assertTrue(obj.has("txSignature"))
        assertTrue(obj.has("signature"))
        assertTrue(obj.has("verifierPublicKey"))
        assertTrue(obj.has("slot"))
    }

    @Test
    fun verifyProof_acceptsOwnProof() {
        val kp   = FernlinkJni.generateKeypair()
        val seed = kp.sliceArray(0..31)
        val json = FernlinkJni.signProof(
            keypairSeed = seed,
            txSignature = "5wHu1a8pgZFo9t5WNpV3BKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQ",
            statusByte  = 0,
            slot        = 123456789L,
            blockTime   = 1700000000L,
            errorCode   = 0,
        )!!
        assertTrue("self-signed proof should verify", FernlinkJni.verifyProof(json))
    }

    @Test
    fun verifyProof_rejectsTamperedSignature() {
        val kp   = FernlinkJni.generateKeypair()
        val seed = kp.sliceArray(0..31)
        val json = FernlinkJni.signProof(
            keypairSeed = seed,
            txSignature = "5wHu1a8pgZFo9t5WNpV3BKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQ",
            statusByte  = 0,
            slot        = 123456789L,
            blockTime   = 1700000000L,
            errorCode   = 0,
        )!!
        val tampered = JSONObject(json).apply {
            put("signature", "aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111" +
                    "aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111")
        }.toString()
        assertFalse("tampered proof should not verify", FernlinkJni.verifyProof(tampered))
    }

    @Test
    fun evaluateProofs_settlesWithOneProof() {
        val kp   = FernlinkJni.generateKeypair()
        val seed = kp.sliceArray(0..31)
        val proof = FernlinkJni.signProof(
            keypairSeed = seed,
            txSignature = "5wHu1a8pgZFo9t5WNpV3BKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQ",
            statusByte  = 0,
            slot        = 123456789L,
            blockTime   = 1700000000L,
            errorCode   = 0,
        )!!
        val arr = JSONArray().apply { put(JSONObject(proof)) }.toString()
        val result = FernlinkJni.evaluateProofs(arr, 1)
        assertNotNull("evaluateProofs returned null", result)
        val obj = JSONObject(result!!)
        assertTrue(obj.getBoolean("settled"))
        assertEquals("confirmed", obj.getString("status"))
    }

    @Test
    fun evaluateProofs_doesNotSettleWhenMinProofsNotMet() {
        val kp   = FernlinkJni.generateKeypair()
        val seed = kp.sliceArray(0..31)
        val proof = FernlinkJni.signProof(
            keypairSeed = seed,
            txSignature = "5wHu1a8pgZFo9t5WNpV3BKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQKQ",
            statusByte  = 0,
            slot        = 123456789L,
            blockTime   = 1700000000L,
            errorCode   = 0,
        )!!
        val arr = JSONArray().apply { put(JSONObject(proof)) }.toString()
        val result = FernlinkJni.evaluateProofs(arr, 3) // requires 3, only 1 provided
        assertNotNull(result)
        val obj = JSONObject(result!!)
        assertFalse(obj.getBoolean("settled"))
    }

    @Test
    fun keypairSeed_deterministic() {
        val seed = ByteArray(32) { it.toByte() }
        val kp1  = FernlinkJni.generateKeypair().also { seed.copyInto(it, 0, 0, 32) }
        val kp2  = FernlinkJni.generateKeypair().also { seed.copyInto(it, 0, 0, 32) }
        // Same seed produces the same public key (bytes 32..63)
        assertArrayEquals(kp1.sliceArray(32..63), kp2.sliceArray(32..63))
    }
}
