package com.heres.mobile.wallet

import android.util.Base64
import androidx.activity.ComponentActivity
import android.net.Uri
import com.funkatronics.encoders.Base58
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.ConnectionIdentity
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.RpcCluster
import com.solana.mobilewalletadapter.clientlib.TransactionParams
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import com.solana.mobilewalletadapter.clientlib.protocol.MobileWalletAdapterClient

class WalletSigner(
    private val activity: ComponentActivity,
    private val sender: ActivityResultSender
) {
    private val identityUri = "https://heres.vercel.app"
    private val relativeIconUri: Uri = Uri.EMPTY

    private val walletAdapter = MobileWalletAdapter(
        connectionIdentity = ConnectionIdentity(
            identityUri = Uri.parse(identityUri),
            iconUri = relativeIconUri,
            identityName = "Heres Mobile",
        )
    )

    suspend fun connectWallet(): Result<String> {
        return runCatching {
            val result = walletAdapter.transact(sender) { _ ->
                authorize(
                    Uri.parse(identityUri),
                    relativeIconUri,
                    "Heres Mobile",
                    RpcCluster.Devnet
                )
            }

            when (result) {
                is TransactionResult.Success<*> -> {
                    val payload = result.payload as? MobileWalletAdapterClient.AuthorizationResult
                        ?: throw IllegalStateException("Wallet returned unexpected authorization payload")
                    val firstAccount = payload.accounts?.firstOrNull()
                    val pkBytes = firstAccount?.publicKey ?: payload.publicKey
                    if (pkBytes == null) throw IllegalStateException("No authorized account returned")
                    Base58.encodeToString(pkBytes)
                }
                is TransactionResult.Failure<*> -> throw IllegalStateException(result.message, result.e)
                is TransactionResult.NoWalletFound<*> -> throw IllegalStateException(result.message)
                else -> throw IllegalStateException("Unknown wallet result")
            }
        }
    }

    suspend fun signAndSendUnsignedTx(unsignedTxBase64: String): Result<String> {
        return runCatching {
            val txBytes = Base64.decode(unsignedTxBase64, Base64.DEFAULT)

            val result = walletAdapter.transact(sender) { _ ->
                signAndSendTransactions(
                    arrayOf(txBytes),
                    TransactionParams(
                        null,
                        "confirmed",
                        false,
                        null,
                        true
                    )
                )
            }

            when (result) {
                is TransactionResult.Success<*> -> {
                    val payload = result.payload as? MobileWalletAdapterClient.SignAndSendTransactionsResult
                        ?: throw IllegalStateException("Wallet returned unexpected payload")
                    val signatureBytes = payload.signatures.firstOrNull()
                        ?: throw IllegalStateException("No signature returned from wallet")
                    Base58.encodeToString(signatureBytes)
                }
                is TransactionResult.Failure<*> -> throw IllegalStateException(result.message, result.e)
                is TransactionResult.NoWalletFound<*> -> throw IllegalStateException(result.message)
                else -> throw IllegalStateException("Unknown wallet result")
            }
        }
    }
}
