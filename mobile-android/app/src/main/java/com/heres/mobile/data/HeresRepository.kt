package com.heres.mobile.data

import com.heres.mobile.BuildConfig
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.create
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.MediaType.Companion.toMediaType

@OptIn(ExperimentalSerializationApi::class)
class HeresRepository {
    private val api: HeresApi

    init {
        val logger = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

        val okHttp = OkHttpClient.Builder()
            .addInterceptor(logger)
            .build()

        val json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
        }

        val retrofit = Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttp)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

        api = retrofit.create()
    }

    suspend fun getActivityScore(wallet: String): ActivityScoreResponse = api.getActivityScore(wallet)

    suspend fun getMyCapsules(wallet: String): List<CapsuleListItem> = api.getMyCapsules(wallet).items

    suspend fun getCapsuleDetail(address: String): CapsuleDetailResponse = api.getCapsuleDetail(address)

    suspend fun getExtendPreview(wallet: String): ExtendPreviewResponse =
        api.getExtendPreview(ExtendPreviewRequest(wallet))

    suspend fun buildCreateCapsuleUnsignedTx(
        owner: String,
        totalSol: String,
        inactivityDays: Int,
        beneficiaryAddress: String,
        beneficiaryAmountSol: String,
        intent: String
    ): UnsignedTxResponse = api.buildCreateCapsuleUnsignedTx(
        CreateCapsuleUnsignedRequest(
            owner = owner,
            totalSol = totalSol,
            inactivityDays = inactivityDays,
            beneficiaryAddress = beneficiaryAddress,
            beneficiaryAmountSol = beneficiaryAmountSol,
            intent = intent
        )
    )

    suspend fun buildUpdateActivityUnsignedTx(owner: String): UnsignedTxResponse =
        api.buildUpdateActivityUnsignedTx(UpdateActivityUnsignedRequest(owner))
}
