package xyz.fernlink.sdk.ble

import java.util.UUID

object BleUuids {
    val FERNLINK_SERVICE:   UUID = UUID.fromString("fern0000-0000-1000-8000-00805f9b34fb")
    val CHAR_REQUEST:       UUID = UUID.fromString("fern0001-0000-1000-8000-00805f9b34fb")
    val CHAR_PROOF:         UUID = UUID.fromString("fern0002-0000-1000-8000-00805f9b34fb")
    val CHAR_STATUS:        UUID = UUID.fromString("fern0003-0000-1000-8000-00805f9b34fb")
    val DESCRIPTOR_CCC:     UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    const val MTU = 512
}
