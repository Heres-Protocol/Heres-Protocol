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

    suspend fun getDashboardCapsules(wallet: String? = null): DashboardCapsulesResponse = callApi {
        api.getDashboardCapsules(wallet?.takeIf { it.isNotBlank() })
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

    suspend fun registerCapsuleOwner(owner: String) {
        callApi {
            api.registerCapsuleOwner(RegisterCapsuleOwnerRequest(owner))
        }
    }

    suspend fun getDashboardCapsulesSafe(wallet: String? = null): DashboardCapsulesResponse {
        return try {
            getDashboardCapsules(wallet)
        } catch (error: IllegalStateException) {
            val walletValue = wallet?.trim().orEmpty()
            if (!error.message.orEmpty().contains("HTTP 404") || walletValue.isBlank()) {
                throw error
            }

            val myCapsules = getMyCapsules(walletValue)
            DashboardCapsulesResponse(
                wallet = walletValue,
                summary = DashboardSummaryResponse(
                    total = myCapsules.size,
                    active = myCapsules.count { it.status == "active" },
                    executed = myCapsules.count { it.status == "executed" },
                    expired = myCapsules.count { it.status == "expired" },
                ),
                items = myCapsules
            )
        }
    }

    private suspend fun <T> callApi(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: HttpException) {
            throw IllegalStateException(mapHttpError(error), error)
        } catch (error: IOException) {
            throw IllegalStateException("Check your network connection and try again.", error)
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
            return "The wallet address format is invalid."
        }
        if (code == 404 && serverMessage == "Capsule not found") {
            return "The requested capsule could not be found."
        }
        if (serverMessage?.contains("Reached maximum depth for account resolution") == true) {
            return "The capsule creation API is failing on the server right now. Please try again shortly."
        }
        if (code >= 500) {
            return "A server error occurred. Please try again shortly."
        }
        if (!serverMessage.isNullOrBlank()) {
            return serverMessage
        }
        return "Request failed. (HTTP $code)"
    }
}
