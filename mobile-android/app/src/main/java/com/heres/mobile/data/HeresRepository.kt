package com.heres.mobile.data

import com.heres.mobile.BuildConfig
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.create
import java.io.IOException

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

    suspend fun getActivityScore(wallet: String): ActivityScoreResponse = callApi {
        api.getActivityScore(wallet)
    }

    suspend fun getMyCapsules(wallet: String): List<CapsuleListItem> = callApi {
        api.getMyCapsules(wallet).items
    }

    suspend fun getCapsuleDetail(address: String): CapsuleDetailResponse = callApi {
        api.getCapsuleDetail(address)
    }

    suspend fun getExtendPreview(wallet: String): ExtendPreviewResponse = callApi {
        api.getExtendPreview(ExtendPreviewRequest(wallet))
    }

    suspend fun buildCreateCapsuleUnsignedTx(
        owner: String,
        totalSol: String,
        inactivityDays: Int,
        beneficiaryAddress: String,
        beneficiaryAmountSol: String,
        intent: String
    ): UnsignedTxResponse = callApi {
        api.buildCreateCapsuleUnsignedTx(
            CreateCapsuleUnsignedRequest(
                owner = owner,
                totalSol = totalSol,
                inactivityDays = inactivityDays,
                beneficiaryAddress = beneficiaryAddress,
                beneficiaryAmountSol = beneficiaryAmountSol,
                intent = intent
            )
        )
    }

    suspend fun buildUpdateActivityUnsignedTx(owner: String): UnsignedTxResponse = callApi {
        api.buildUpdateActivityUnsignedTx(UpdateActivityUnsignedRequest(owner))
    }

    private suspend fun <T> callApi(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: HttpException) {
            throw IllegalStateException(mapHttpError(error), error)
        } catch (error: IOException) {
            throw IllegalStateException("네트워크 연결을 확인해 주세요.", error)
        }
    }

    private fun mapHttpError(error: HttpException): String {
        val code = error.code()
        val body = runCatching { error.response()?.errorBody()?.string().orEmpty() }.getOrDefault("")
        val serverMessage = "\"error\"\\s*:\\s*\"([^\"]+)\"".toRegex()
            .find(body)
            ?.groupValues
            ?.getOrNull(1)
            ?.trim()

        if (code == 400 && serverMessage == "Invalid wallet address") {
            return "지갑 주소 형식이 올바르지 않습니다."
        }
        if (code == 404 && serverMessage == "Capsule not found") {
            return "해당 캡슐을 찾을 수 없습니다."
        }
        if (serverMessage?.contains("Reached maximum depth for account resolution") == true) {
            return "캡슐 생성 API가 현재 서버에서 실패하고 있습니다. 잠시 후 다시 시도해 주세요."
        }
        if (code >= 500) {
            return "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        }
        if (!serverMessage.isNullOrBlank()) {
            return serverMessage
        }
        return "요청에 실패했습니다. (HTTP $code)"
    }
}
