package com.heres.mobile

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.Surface
import com.heres.mobile.ui.HeresRoot
import com.heres.mobile.ui.HeresTheme
import com.heres.mobile.wallet.WalletSigner
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender

class MainActivity : ComponentActivity() {
    companion object {
        private const val PREFS_NAME = "heres-mobile"
        private const val PREF_WALLET_ADDRESS = "wallet_address"
    }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        val sender = ActivityResultSender(this)
        val walletSigner = WalletSigner(this, sender)
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val savedWallet = prefs.getString(PREF_WALLET_ADDRESS, null)

        setContent {
            HeresTheme {
                Surface {
                    HeresRoot(
                        initialWallet = savedWallet,
                        onWalletConnected = { wallet ->
                            prefs.edit().putString(PREF_WALLET_ADDRESS, wallet).apply()
                        },
                        onConnectWallet = { walletSigner.connectWallet() },
                        onSignAndSendUnsignedTx = { unsigned -> walletSigner.signAndSendUnsignedTx(unsigned) }
                    )
                }
            }
        }
    }
}
