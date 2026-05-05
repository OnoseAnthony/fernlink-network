package xyz.fernlink.sdk.wifi

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat

internal object WifiServiceNotification {

    const val NOTIFICATION_ID = 1002
    private const val CHANNEL_ID = "fernlink_wifi"

    fun build(context: Context, peerCount: Int): android.app.Notification {
        ensureChannel(context)
        val text = if (peerCount > 0) "WiFi peers: $peerCount" else "Scanning for WiFi peers…"
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Fernlink WiFi Direct")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
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
