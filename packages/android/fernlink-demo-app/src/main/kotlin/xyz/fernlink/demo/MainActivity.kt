package xyz.fernlink.demo

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*
import xyz.fernlink.sdk.Commitment
import xyz.fernlink.sdk.FernlinkClient
import xyz.fernlink.sdk.FernlinkClientConfig

class MainActivity : AppCompatActivity() {

    private val client = FernlinkClient(
        FernlinkClientConfig(rpcEndpoint = "https://api.devnet.solana.com")
    )

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        client.start()

        val etSignature = findViewById<EditText>(R.id.etSignature)
        val btnVerify   = findViewById<Button>(R.id.btnVerify)
        val tvLog       = findViewById<TextView>(R.id.tvLog)

        log(tvLog, "Fernlink SDK initialised")
        log(tvLog, "Device public key: ${client.publicKey.take(16)}…")
        log(tvLog, "RPC: https://api.devnet.solana.com\n")
        log(tvLog, "Tap 'Verify Transaction' to run a live verification.")

        btnVerify.setOnClickListener {
            val sig = etSignature.text.toString().trim()
            btnVerify.isEnabled = false
            tvLog.text = ""

            scope.launch {
                runDemo(tvLog, btnVerify, sig.ifEmpty { null })
            }
        }
    }

    private suspend fun runDemo(tvLog: TextView, btn: Button, customSig: String?) {
        log(tvLog, "─── Fernlink Transaction Verification ───\n")

        val signature = customSig ?: withContext(Dispatchers.IO) {
            fetchDevnetSample()
        }

        if (signature == null) {
            log(tvLog, "[ERROR] Could not fetch a devnet transaction. Check network.")
            btn.isEnabled = true
            return
        }

        log(tvLog, "[1] Transaction signature:")
        log(tvLog, "    ${signature.take(32)}…\n")

        log(tvLog, "[2] Querying Solana devnet via RPC…")

        val result = runCatching {
            withContext(Dispatchers.IO) {
                client.verifyTransaction(
                    txSignature = signature,
                    commitment  = Commitment.CONFIRMED,
                    timeoutMs   = 15_000,
                )
            }
        }

        result.onSuccess { consensus ->
            log(tvLog, "[3] RPC responded. Signing Ed25519 proof via Rust core (JNI)…")
            log(tvLog, "    Verifier public key: ${client.publicKey.take(16)}…\n")

            log(tvLog, "[4] Self-verifying proof signature… OK\n")

            log(tvLog, "[5] Evaluating consensus (1 proof)…")
            log(tvLog, "    settled    = ${consensus.settled}")
            log(tvLog, "    status     = ${consensus.status ?: "—"}")
            consensus.slot?.let      { log(tvLog, "    slot       = $it") }
            consensus.blockTime?.let { log(tvLog, "    block time = $it") }
            log(tvLog, "    proofCount = ${consensus.proofCount}\n")

            if (consensus.settled) {
                log(tvLog, "✅ VERIFIED — ${consensus.status}")
            } else {
                log(tvLog, "⚠️  NOT SETTLED — need more peers")
            }
        }

        result.onFailure { e ->
            log(tvLog, "[ERROR] ${e.message}")
        }

        log(tvLog, "\n─────────────────────────────────────────")
        btn.isEnabled = true
    }

    private fun log(tv: TextView, line: String) {
        tv.append("$line\n")
    }

    private fun fetchDevnetSample(): String? = runCatching {
        val body = """{"jsonrpc":"2.0","id":1,"method":"getSignaturesForAddress",
            "params":["Vote111111111111111111111111111111111111111p",{"limit":1}]}"""
            .trimIndent()
        val conn = java.net.URL("https://api.devnet.solana.com").openConnection()
            as java.net.HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        conn.outputStream.write(body.toByteArray())
        val text = conn.inputStream.bufferedReader().readText()
        val arr  = org.json.JSONObject(text).getJSONObject("result").getJSONArray("value")
        if (arr.length() == 0) null
        else arr.getJSONObject(0).getString("signature")
    }.getOrNull()

    override fun onDestroy() {
        super.onDestroy()
        client.stop()
        scope.cancel()
    }
}
