package com.heres.mobile.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.heres.mobile.data.HeresRepository
import com.heres.mobile.util.NotificationHelper

class ActivityMonitorWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    private val repository = HeresRepository()

    override suspend fun doWork(): Result {
        val wallet = inputData.getString(KEY_WALLET) ?: return Result.success()

        return runCatching {
            val score = repository.getActivityScore(wallet)
            val preview = repository.getExtendPreview(wallet)

            if (preview.canExtend && score.score >= 60) {
                NotificationHelper.showExtendCandidate(applicationContext, wallet, score.score)
            }
            Result.success()
        }.getOrElse {
            Result.retry()
        }
    }

    companion object {
        const val WORK_NAME = "heres_activity_monitor"
        const val KEY_WALLET = "wallet"
    }
}
