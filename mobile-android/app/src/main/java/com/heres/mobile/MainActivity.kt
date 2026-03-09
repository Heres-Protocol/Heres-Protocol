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
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        val sender = ActivityResultSender(this)
        val walletSigner = WalletSigner(this, sender)

        setContent {
            HeresTheme {
                Surface {
                    HeresRoot(
                        onConnectWallet = { walletSigner.connectWallet() },
                        onSignAndSendUnsignedTx = { unsigned -> walletSigner.signAndSendUnsignedTx(unsigned) }
                    )
                }
            }
        }
    }
}
