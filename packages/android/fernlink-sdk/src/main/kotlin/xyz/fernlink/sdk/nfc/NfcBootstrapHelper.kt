package xyz.fernlink.sdk.nfc

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import org.json.JSONObject

/**
 * NFC bootstrapping helper for Fernlink.
 *
 * Tap two devices together to exchange BLE credentials (public key + service UUID
 * + BLE MAC address). The receiving device calls GattClientManager.connectDirect()
 * to skip the ~5s BLE scan and connect in ~200ms.
 *
 * Usage from your Activity:
 * ```kotlin
 * val helper = client.createNfcBootstrapHelper(this) { bleAddress ->
 *     Toast.makeText(this, "NFC paired! Connecting…", Toast.LENGTH_SHORT).show()
 * }
 * // In onResume:
 * helper.onResume()
 * // In onPause:
 * helper.onPause()
 * // In onNewIntent:
 * helper.onNewIntent(intent)
 * ```
 *
 * NFC requires Activity context — cannot run from a Service. This is an
 * Android platform constraint with no workaround.
 */
class NfcBootstrapHelper(
    private val activity:           Activity,
    private val localPublicKey:     String,
    private val localBleMacAddress: String?,
    private val onBootstrapReceived: (peerPublicKey: String, bleAddress: String?) -> Unit,
) {
    private val nfcAdapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(activity)

    /** Call from Activity.onResume(). Enables NFC foreground dispatch. */
    fun onResume() {
        val adapter = nfcAdapter ?: return
        val pendingIntent = android.app.PendingIntent.getActivity(
            activity, 0,
            android.content.Intent(activity, activity.javaClass).addFlags(
                android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
            ),
            android.app.PendingIntent.FLAG_MUTABLE,
        )
        val filters = arrayOf(
            android.content.IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED).apply {
                addDataType(NfcConstants.MIME_TYPE)
            }
        )
        adapter.enableForegroundDispatch(activity, pendingIntent, filters, null)
        // Android Beam (setNdefPushMessage) was removed in API 33.
        // Outbound bootstrap uses HCE; this side handles incoming reads.
    }

    /** Call from Activity.onPause(). Disables foreground dispatch. */
    fun onPause() {
        nfcAdapter?.disableForegroundDispatch(activity)
    }

    /** Call from Activity.onNewIntent(intent). Processes incoming NFC bootstrap records. */
    fun onNewIntent(intent: android.content.Intent) {
        if (intent.action != NfcAdapter.ACTION_NDEF_DISCOVERED &&
            intent.action != NfcAdapter.ACTION_TAG_DISCOVERED) return

        val rawMessages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES, NdefMessage::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
                ?.map { it as NdefMessage }?.toTypedArray()
        } ?: return

        rawMessages.firstOrNull()?.let { message ->
            parseBootstrapRecord(message)?.let { (pubKey, bleAddr) ->
                onBootstrapReceived(pubKey, bleAddr)
            }
        }
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private fun buildNdefMessage(): NdefMessage {
        val payload = JSONObject().apply {
            put("v",   NfcConstants.BOOTSTRAP_VERSION)
            put("pk",  localPublicKey)
            put("ble", "fern0000-0000-1000-8000-00805f9b34fb")
            localBleMacAddress?.let { put("mac", it) }
        }.toString().toByteArray(Charsets.UTF_8)

        val record = NdefRecord.createMime(NfcConstants.MIME_TYPE, payload)
        return NdefMessage(arrayOf(record))
    }

    private fun parseBootstrapRecord(message: NdefMessage): Pair<String, String?>? {
        val record = message.records.firstOrNull { rec ->
            rec.toMimeType() == NfcConstants.MIME_TYPE
        } ?: return null

        return runCatching {
            val json   = JSONObject(String(record.payload, Charsets.UTF_8))
            val pubKey = json.getString("pk")
            val mac    = json.optString("mac").takeIf { it.isNotEmpty() }
            Pair(pubKey, mac)
        }.getOrNull()
    }
}
