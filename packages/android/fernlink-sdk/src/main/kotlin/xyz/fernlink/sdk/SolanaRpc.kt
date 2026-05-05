package xyz.fernlink.sdk

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

internal class SolanaRpc(private val endpoint: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val json = "application/json".toMediaType()

    data class SignatureStatus(
        val status: TxStatus,
        val slot: Long,
        val blockTime: Long = 0,
    )

    suspend fun getSignatureStatus(signature: String): SignatureStatus = withContext(Dispatchers.IO) {
        val bodyObj = JSONObject().apply {
            put("jsonrpc", "2.0")
            put("id", 1)
            put("method", "getSignatureStatuses")
            put("params", org.json.JSONArray().apply {
                put(org.json.JSONArray().apply { put(signature) })
                put(JSONObject().apply { put("searchTransactionHistory", true) })
            })
        }
        val body = bodyObj.toString().toRequestBody(json)

        val request = Request.Builder().url(endpoint).post(body).build()
        val response = client.newCall(request).execute()
        val text = response.body?.string() ?: throw RuntimeException("empty RPC response")

        val root   = JSONObject(text)
        val result = root.optJSONObject("result") ?: return@withContext SignatureStatus(TxStatus.UNKNOWN, 0)
        val value  = result.optJSONArray("value")?.optJSONObject(0)
            ?: return@withContext SignatureStatus(TxStatus.UNKNOWN, 0)

        val slot   = value.optLong("slot", 0)
        val hasErr = !value.isNull("err")
        SignatureStatus(
            status = if (hasErr) TxStatus.FAILED else TxStatus.CONFIRMED,
            slot   = slot,
        )
    }
}
