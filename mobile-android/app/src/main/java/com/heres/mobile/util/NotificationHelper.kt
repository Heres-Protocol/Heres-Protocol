package com.heres.mobile.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object NotificationHelper {
    const val CHANNEL_ID = "heres_activity_channel"

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Heres Activity",
            NotificationManager.IMPORTANCE_DEFAULT
        )
        channel.description = "Activity-based extension alerts"
        manager.createNotificationChannel(channel)
    }

    fun showExtendCandidate(context: Context, wallet: String, score: Int) {
        ensureChannel(context)

        val notif = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Activity detected: extension recommended")
            .setContentText("Wallet ${wallet.take(4)}... score=$score. Open app to one-tap extend.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        NotificationManagerCompat.from(context).notify(2001, notif)
    }
}
