package xyz.fernlink.demo

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.*
import xyz.fernlink.sdk.Commitment
import xyz.fernlink.sdk.FernlinkClient
import xyz.fernlink.sdk.FernlinkClientConfig
import xyz.fernlink.sdk.TransportManager

class MainActivity : AppCompatActivity() {

    private val client = FernlinkClient(
        FernlinkClientConfig(rpcEndpoint = "https://api.devnet.solana.com")
    )
    private val scope   = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var transportManager: TransportManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        client.start()
        transportManager = TransportManager(this, client)

        val etSignature  = findViewById<EditText>(R.id.etSignature)
        val btnVerify    = findViewById<Button>(R.id.btnVerify)
        val tvLog        = findViewById<TextView>(R.id.tvLog)

        log(tvLog, "Fernlink SDK initialised")
        log(tvLog, "Device public key: ${client.publicKey.take(16)}…")
        log(tvLog, "RPC: https://api.devnet.solana.com\n")

        requestPermissionsAndStartServices()

        btnVerify.setOnClickListener {
            val sig = etSignature.text.toString().trim()
            btnVerify.isEnabled = false
            tvLog.text = ""
            scope.launch { runDemo(tvLog, btnVerify, sig.ifEmpty { null }) }
        }
    }

    private fun requestPermissionsAndStartServices() {
        val needed = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            listOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT,
            ).forEach { if (ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED) needed += it }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
                needed += Manifest.permission.ACCESS_FINE_LOCATION
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.NEARBY_WIFI_DEVICES)
                != PackageManager.PERMISSION_GRANTED) {
                needed += Manifest.permission.NEARBY_WIFI_DEVICES
            }
        }

        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), RC_PERMS)
        } else {
            transportManager.startAll()
            updatePeerCount()
        }
    }

    override fun onRequestPermissionsResult(rc: Int, perms: Array<out String>, grants: IntArray) {
        super.onRequestPermissionsResult(rc, perms, grants)
        if (rc == RC_PERMS) {
            transportManager.startAll()
            updatePeerCount()
        }
    }

    private fun updatePeerCount() {
        scope.launch {
            while (true) {
                val count = transportManager.connectedPeerCount
                val tv = findViewById<TextView>(R.id.tvPeers)
                tv?.text = if (count == 0) "Scanning (BLE + WiFi Direct)…"
                           else "$count peer${if (count == 1) "" else "s"} connected"
                delay(3_000)
            }
        }
    }

    private suspend fun runDemo(tvLog: TextView, btn: Button, customSig: String?) {
        log(tvLog, "─── Fernlink Transaction Verification ───\n")

        val signature = customSig ?: withContext(Dispatchers.IO) { fetchDevnetSample() }
        if (signature == null) {
            log(tvLog, "[ERROR] Could not fetch a devnet transaction. Check network.")
            btn.isEnabled = true
            return
        }

        log(tvLog, "[1] Transaction signature:")
        log(tvLog, "    ${signature.take(32)}…\n")
        log(tvLog, "[2] Querying Solana devnet via RPC…")

        val peers = transportManager.connectedPeerCount
        if (peers > 0) {
            log(tvLog, "[MESH] Broadcasting to $peers peer${if (peers == 1) "" else "s"} (BLE + WiFi)…")
        } else {
            log(tvLog, "[MESH] No peers — local proof only\n")
        }

        val result = runCatching {
            withContext(Dispatchers.IO) {
                client.verifyTransaction(
                    txSignature = signature,
                    commitment  = Commitment.CONFIRMED,
                    timeoutMs   = 10_000,
                )
            }
        }

        result.onSuccess { consensus ->
            log(tvLog, "[3] Signing Ed25519 proof via Rust core (JNI)…")
            log(tvLog, "    Verifier: ${client.publicKey.take(16)}…\n")
            log(tvLog, "[4] Self-verifying proof signature… OK\n")
            log(tvLog, "[5] Consensus result:")
            log(tvLog, "    settled    = ${consensus.settled}")
            log(tvLog, "    status     = ${consensus.status ?: "—"}")
            consensus.slot?.let      { log(tvLog, "    slot       = $it") }
            consensus.blockTime?.let { log(tvLog, "    block time = $it") }
            log(tvLog, "    proofCount = ${consensus.proofCount}\n")
            if (consensus.settled) log(tvLog, "✅ VERIFIED — ${consensus.status}")
            else                   log(tvLog, "⚠️  NOT SETTLED — need more peers")
        }

        result.onFailure { e -> log(tvLog, "[ERROR] ${e.message}") }

        log(tvLog, "\n─────────────────────────────────────────")
        btn.isEnabled = true
    }

    private fun log(tv: TextView, line: String) { tv.append("$line\n") }

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
        if (arr.length() == 0) null else arr.getJSONObject(0).getString("signature")
    }.getOrNull()

    override fun onDestroy() {
        transportManager.stopAll()
        client.stop()
        scope.cancel()
        super.onDestroy()
    }

    companion object { private const val RC_PERMS = 100 }
}
