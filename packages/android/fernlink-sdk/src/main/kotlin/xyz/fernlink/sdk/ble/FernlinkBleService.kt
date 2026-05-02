package xyz.fernlink.sdk.ble

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import kotlinx.coroutines.*

/**
 * Foreground Android Service that hosts the Fernlink BLE mesh layer.
 *
 * Bind to this service from your Activity, then attach it to a FernlinkClient:
 *
 * ```kotlin
 * val connection = object : ServiceConnection {
 *     override fun onServiceConnected(name: ComponentName, binder: IBinder) {
 *         val service = (binder as FernlinkBleService.LocalBinder).service
 *         client.attachBleService(service)
 *     }
 *     override fun onServiceDisconnected(name: ComponentName) = Unit
 * }
 * bindService(Intent(this, FernlinkBleService::class.java), connection, BIND_AUTO_CREATE)
 * startForegroundService(Intent(this, FernlinkBleService::class.java))
 * ```
 */
class FernlinkBleService : Service() {

    inner class LocalBinder : Binder() {
        val service: FernlinkBleService get() = this@FernlinkBleService
    }

    private val binder = LocalBinder()
    private val scope  = CoroutineScope(Dispatchers.IO + SupervisorJob())

    internal lateinit var server: GattServerManager
    internal lateinit var client: GattClientManager
    internal lateinit var router: BleMessageRouter

    private var keypairSeed: ByteArray = ByteArray(32)
    private var initialised = false

    override fun onCreate() {
        super.onCreate()
        server = GattServerManager(applicationContext)
        client = GattClientManager(applicationContext)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(
            ForegroundServiceNotification.notificationId(),
            ForegroundServiceNotification.build(applicationContext, 0),
        )
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder = binder

    override fun onDestroy() {
        stopMesh()
        scope.cancel()
        super.onDestroy()
    }

    // ── Public API (called by FernlinkClient after binding) ───────────────────

    fun startMesh(keypairSeed: ByteArray) {
        if (initialised) return
        this.keypairSeed = keypairSeed.copyOf()
        router = BleMessageRouter(server, client, this.keypairSeed, scope)
        server.start()
        client.startScanning()
        router.start()
        initialised = true
        updateNotification()
    }

    fun stopMesh() {
        if (!initialised) return
        client.stop()
        server.stop()
        initialised = false
    }

    val connectedPeerCount: Int
        get() = if (initialised) client.connectedPeerCount else 0

    fun broadcastRequest(txSignature: String, statusByte: Byte, slot: Long, blockTime: Long) {
        if (!initialised) return
        router.broadcastRequest(txSignature, statusByte, slot, blockTime)
    }

    fun collectConsensusJson(minProofs: Int): String? =
        if (initialised) router.collectConsensusJson(minProofs) else null

    fun clearProofs() { if (initialised) router.clearProofs() }

    private fun updateNotification() {
        scope.launch {
            while (initialised) {
                val nm = getSystemService(NOTIFICATION_SERVICE)
                    as android.app.NotificationManager
                nm.notify(
                    ForegroundServiceNotification.notificationId(),
                    ForegroundServiceNotification.build(applicationContext, connectedPeerCount),
                )
                delay(5_000)
            }
        }
    }
}
