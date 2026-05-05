package xyz.fernlink.sdk.ble

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat

internal object ForegroundServiceNotification {

    private const val CHANNEL_ID   = "fernlink_ble"
    private const val CHANNEL_NAME = "Fernlink BLE"
    private const val NOTIFICATION_ID = 1001

    fun notificationId() = NOTIFICATION_ID

    fun build(context: Context, peerCount: Int): android.app.Notification {
        ensureChannel(context)
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Fernlink")
            .setContentText(
                if (peerCount == 0) "Scanning for peers…"
                else "$peerCount peer${if (peerCount == 1) "" else "s"} connected"
            )
            .setOngoing(true)
            .build()
    }

    private fun ensureChannel(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW)
        )
    }
}
