package xyz.fernlink.sdk.wifi

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

internal object WifiServiceNotification {

    const val NOTIFICATION_ID = 1002
    private const val CHANNEL_ID = "fernlink_wifi"

    fun build(context: Context, peerCount: Int): Notification {
        ensureChannel(context)
        val text = if (peerCount > 0) "WiFi peers: $peerCount" else "Scanning for WiFi peers…"
        return Notification.Builder(context, CHANNEL_ID)
            .setContentTitle("Fernlink WiFi Direct")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_data_wifi)
            .setOngoing(true)
            .build()
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Fernlink WiFi Direct", NotificationManager.IMPORTANCE_LOW)
        )
    }
}
