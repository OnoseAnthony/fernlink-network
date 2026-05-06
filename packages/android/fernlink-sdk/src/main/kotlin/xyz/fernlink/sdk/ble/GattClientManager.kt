package xyz.fernlink.sdk.ble

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONObject
import xyz.fernlink.sdk.WirePayload

/**
 * Scans for Fernlink peripherals, connects, and subscribes to PROOF notifications.
 *
 * Incoming proof fragments are reassembled and emitted on [incomingProofs].
 * Call [sendRequest] to write a fragmented verification request to all connected peers.
 * When a new peer connects, any requests buffered in [proofStore] are drained first.
 */
internal class GattClientManager(
    private val context: Context,
    private val proofStore: ProofStore,
) {

    private val _incomingProofs = MutableSharedFlow<ByteArray>(extraBufferCapacity = 32)
    val incomingProofs: SharedFlow<ByteArray> = _incomingProofs

    private val connections  = mutableMapOf<String, BluetoothGatt>()
    private val reassemblers = mutableMapOf<String, BleFragmentation.Reassembler>()

    private val manager get() =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

    private val scanner get() = manager.adapter.bluetoothLeScanner

    fun startScanning() {
        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(BleUuids.FERNLINK_SERVICE))
            .build()
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()
        scanner?.startScan(listOf(filter), settings, scanCallback)
    }

    fun stopScanning() {
        scanner?.stopScan(scanCallback)
    }

    fun stop() {
        stopScanning()
        connections.values.forEach { it.close() }
        connections.clear()
        reassemblers.clear()
    }

    fun sendRequest(payload: ByteArray) {
        val fragments = BleFragmentation.fragment(WirePayload.encode(payload))
        connections.values.forEach { gatt ->
            val char = gatt.getService(BleUuids.FERNLINK_SERVICE)
                ?.getCharacteristic(BleUuids.CHAR_REQUEST) ?: return@forEach
            fragments.forEach { frag ->
                char.value = frag
                gatt.writeCharacteristic(char)
                Thread.sleep(20)
            }
        }
    }

    val connectedPeerCount: Int get() = connections.size

    /**
     * Skip BLE scanning and connect directly to a known device (e.g. from NFC bootstrap).
     * No-op if already connected to this device.
     */
    fun connectDirect(device: android.bluetooth.BluetoothDevice) {
        if (connections.containsKey(device.address)) return
        device.connectGatt(context, false, gattCallback, android.bluetooth.BluetoothDevice.TRANSPORT_LE)
    }

    // ── Scan callback ─────────────────────────────────────────────────────────

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            if (connections.containsKey(device.address)) return
            device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
        }
    }

    // ── GATT client callbacks ─────────────────────────────────────────────────

    private val gattCallback = object : BluetoothGattCallback() {

        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    connections[gatt.device.address] = gatt
                    gatt.requestMtu(BleUuids.MTU)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    connections.remove(gatt.device.address)
                    reassemblers.remove(gatt.device.address)
                    gatt.close()
                }
            }
        }

        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            gatt.discoverServices()
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) return
            val proofChar = gatt.getService(BleUuids.FERNLINK_SERVICE)
                ?.getCharacteristic(BleUuids.CHAR_PROOF) ?: return

            gatt.setCharacteristicNotification(proofChar, true)
            val ccc = proofChar.getDescriptor(BleUuids.DESCRIPTOR_CCC)
            ccc?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            ccc?.let { gatt.writeDescriptor(it) }

            drainStoreTo(gatt)
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
        ) {
            if (characteristic.uuid != BleUuids.CHAR_PROOF) return
            val reassembler = reassemblers.getOrPut(gatt.device.address) {
                BleFragmentation.Reassembler()
            }
            val complete = reassembler.feed(characteristic.value) ?: return
            _incomingProofs.tryEmit(WirePayload.decode(complete))
        }
    }

    // ── Store-and-forward drain ───────────────────────────────────────────────

    private fun drainStoreTo(gatt: BluetoothGatt) {
        val pending = proofStore.drain()
        if (pending.isEmpty()) return
        val char = gatt.getService(BleUuids.FERNLINK_SERVICE)
            ?.getCharacteristic(BleUuids.CHAR_REQUEST) ?: return
        pending.forEach { req ->
            val payload = JSONObject().apply {
                put("txSignature", req.txSignature)
                put("commitment",  req.commitment)
                put("ttl",         req.ttl)
            }.toString().toByteArray(Charsets.UTF_8)

            BleFragmentation.fragment(WirePayload.encode(payload)).forEach { frag ->
                char.value = frag
                gatt.writeCharacteristic(char)
                Thread.sleep(20)
            }
        }
    }
}
