package com.heres.mobile

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.heres.mobile.worker.ActivityMonitorWorker
import java.util.concurrent.TimeUnit

class HeresApp : Application() {
    override fun onCreate() {
        super.onCreate()

        val work = PeriodicWorkRequestBuilder<ActivityMonitorWorker>(15, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            ActivityMonitorWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            work
        )
    }
}
