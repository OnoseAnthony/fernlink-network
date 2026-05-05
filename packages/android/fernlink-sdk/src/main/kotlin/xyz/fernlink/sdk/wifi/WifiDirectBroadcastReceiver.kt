package xyz.fernlink.sdk.wifi

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager

/**
 * Receives WiFi Direct system broadcasts and forwards them to WifiDirectTransport.
 */
internal class WifiDirectBroadcastReceiver(
    private val manager:   WifiP2pManager,
    private val channel:   WifiP2pManager.Channel,
    private val callbacks: Callbacks,
) : BroadcastReceiver() {

    interface Callbacks {
        fun onP2pEnabled(enabled: Boolean)
        fun onPeersChanged(peers: WifiP2pDeviceList)
        fun onConnectionChanged(connected: Boolean, info: WifiP2pInfo?)
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                val state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1)
                callbacks.onP2pEnabled(state == WifiP2pManager.WIFI_P2P_STATE_ENABLED)
            }
            WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                manager.requestPeers(channel) { peers ->
                    callbacks.onPeersChanged(peers)
                }
            }
            WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                val networkInfo = intent.getParcelableExtra<android.net.NetworkInfo>(
                    WifiP2pManager.EXTRA_NETWORK_INFO
                )
                val connected = networkInfo?.isConnected == true
                if (connected) {
                    manager.requestConnectionInfo(channel) { info ->
                        callbacks.onConnectionChanged(true, info)
                    }
                } else {
                    callbacks.onConnectionChanged(false, null)
                }
            }
        }
    }
}
