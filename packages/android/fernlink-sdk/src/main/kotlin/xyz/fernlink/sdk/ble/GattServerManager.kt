package xyz.fernlink.sdk.ble

import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.os.ParcelUuid
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

/**
 * Hosts the Fernlink GATT server and BLE advertisement.
 *
 * Peers write to CHAR_REQUEST; this server reassembles fragments and emits
 * the complete payload on [incomingRequests]. Call [sendProof] to notify all
 * subscribed centrals with a proof payload.
 */
internal class GattServerManager(private val context: Context) {

    private val _incomingRequests = MutableSharedFlow<ByteArray>(extraBufferCapacity = 32)
    val incomingRequests: SharedFlow<ByteArray> = _incomingRequests

    private var gattServer: BluetoothGattServer? = null
    private val subscribedDevices = mutableSetOf<BluetoothDevice>()
    private val reassemblers = mutableMapOf<String, BleFragmentation.Reassembler>()

    private val manager get() =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

    private val advertiser get() =
        manager.adapter.bluetoothLeAdvertiser

    fun start() {
        gattServer = manager.openGattServer(context, gattCallback).apply {
            addService(buildService())
        }
        startAdvertising()
    }

    fun stop() {
        stopAdvertising()
        gattServer?.close()
        gattServer = null
        subscribedDevices.clear()
        reassemblers.clear()
    }

    fun sendProof(payload: ByteArray) {
        val server    = gattServer ?: return
        val proofChar = server.getService(BleUuids.FERNLINK_SERVICE)
            ?.getCharacteristic(BleUuids.CHAR_PROOF) ?: return

        val fragments = BleFragmentation.fragment(payload)
        subscribedDevices.toList().forEach { device ->
            fragments.forEach { frag ->
                proofChar.value = frag
                server.notifyCharacteristicChanged(device, proofChar, false)
            }
        }
    }

    // ── GATT service definition ───────────────────────────────────────────────

    private fun buildService(): BluetoothGattService {
        val service = BluetoothGattService(
            BleUuids.FERNLINK_SERVICE,
            BluetoothGattService.SERVICE_TYPE_PRIMARY,
        )

        // REQUEST — writable by central (verification requests come in here)
        val request = BluetoothGattCharacteristic(
            BleUuids.CHAR_REQUEST,
            BluetoothGattCharacteristic.PROPERTY_WRITE or
                    BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
            BluetoothGattCharacteristic.PERMISSION_WRITE,
        )

        // PROOF — notifiable (signed proofs go out here)
        val proof = BluetoothGattCharacteristic(
            BleUuids.CHAR_PROOF,
            BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ,
        ).apply {
            addDescriptor(BluetoothGattDescriptor(
                BleUuids.DESCRIPTOR_CCC,
                BluetoothGattDescriptor.PERMISSION_READ or
                        BluetoothGattDescriptor.PERMISSION_WRITE,
            ))
        }

        // STATUS — readable (service version / health byte)
        val status = BluetoothGattCharacteristic(
            BleUuids.CHAR_STATUS,
            BluetoothGattCharacteristic.PROPERTY_READ,
            BluetoothGattCharacteristic.PERMISSION_READ,
        ).apply {
            value = """{"version":2,"commitment":["confirmed","finalized"],"compression":["lz4","zstd"]}"""
                .toByteArray(Charsets.UTF_8)
        }

        service.addCharacteristic(request)
        service.addCharacteristic(proof)
        service.addCharacteristic(status)
        return service
    }

    // ── GATT server callbacks ─────────────────────────────────────────────────

    private val gattCallback = object : BluetoothGattServerCallback() {

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice, requestId: Int,
            characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean, responseNeeded: Boolean,
            offset: Int, value: ByteArray,
        ) {
            if (characteristic.uuid != BleUuids.CHAR_REQUEST) return
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
            }

            val reassembler = reassemblers.getOrPut(device.address) {
                BleFragmentation.Reassembler()
            }
            val complete = reassembler.feed(value) ?: return
            _incomingRequests.tryEmit(complete)
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice, requestId: Int,
            descriptor: BluetoothGattDescriptor,
            preparedWrite: Boolean, responseNeeded: Boolean,
            offset: Int, value: ByteArray,
        ) {
            if (descriptor.uuid != BleUuids.DESCRIPTOR_CCC) return
            if (value.contentEquals(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)) {
                subscribedDevices.add(device)
            } else {
                subscribedDevices.remove(device)
            }
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
            }
        }

        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                subscribedDevices.remove(device)
                reassemblers.remove(device.address)
            }
        }
    }

    // ── Advertising ───────────────────────────────────────────────────────────

    private val advertiseCallback = object : AdvertiseCallback() {}

    private fun startAdvertising() {
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setConnectable(true)
            .setTimeout(0)
            .build()

        val data = AdvertiseData.Builder()
            .addServiceUuid(ParcelUuid(BleUuids.FERNLINK_SERVICE))
            .setIncludeDeviceName(false)
            .build()

        advertiser?.startAdvertising(settings, data, advertiseCallback)
    }

    private fun stopAdvertising() {
        advertiser?.stopAdvertising(advertiseCallback)
    }
}
