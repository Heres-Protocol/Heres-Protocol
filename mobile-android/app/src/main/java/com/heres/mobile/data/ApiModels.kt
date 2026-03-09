package com.heres.mobile.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ActivityScoreResponse(
    val wallet: String,
    @SerialName("lastActivityAt") val lastActivityAt: Long? = null,
    @SerialName("txCount24h") val txCount24h: Int = 0,
    @SerialName("tokenEvents24h") val tokenEvents24h: Int = 0,
    val score: Int = 0,
    @SerialName("recommendedAction") val recommendedAction: String = "monitor"
)

@Serializable
data class CapsulesResponse(
    val wallet: String,
    val items: List<CapsuleListItem> = emptyList()
)

@Serializable
data class DashboardSummaryResponse(
    val total: Int = 0,
    val active: Int = 0,
    val executed: Int = 0,
    val expired: Int = 0,
)

@Serializable
data class DashboardCapsulesResponse(
    val wallet: String? = null,
    val summary: DashboardSummaryResponse = DashboardSummaryResponse(),
    val items: List<CapsuleListItem> = emptyList()
)

@Serializable
data class CapsuleListItem(
    val capsuleAddress: String,
    val owner: String,
    val status: String,
    val inactivitySeconds: Long,
    val lastActivityAt: Long,
    val executedAt: Long? = null,
    val nextInactivityDeadline: Long
)

@Serializable
data class CapsuleDetailResponse(
    val capsuleAddress: String,
    val owner: String,
    val status: String,
    val inactivitySeconds: Long,
    val lastActivityAt: Long,
    val executedAt: Long? = null,
    val nextInactivityDeadline: Long,
    val isActive: Boolean,
    val hasMint: Boolean
)

@Serializable
data class ExtendPreviewRequest(
    val wallet: String
)

@Serializable
data class ExtendPreviewResponse(
    val canExtend: Boolean,
    val reason: String,
    val nextInactivityDeadline: Long? = null,
    val suggestedFeeLamports: Long = 0,
    val remainingMs: Long = 0,
    val score: ActivityScoreResponse? = null
)

@Serializable
data class CreateCapsuleUnsignedRequest(
    val owner: String,
    val totalSol: String,
    val inactivityDays: Int,
    val beneficiaryAddress: String,
    val beneficiaryAmountSol: String,
    val intent: String = "Mobile capsule"
)

@Serializable
data class UnsignedTxResponse(
    val transactionBase64: String,
    val capsuleAddress: String? = null,
    val inactivitySeconds: Int? = null,
    val message: String
)

@Serializable
data class UpdateActivityUnsignedRequest(
    val owner: String
)

@Serializable
data class RegisterCapsuleOwnerRequest(
    val owner: String
)
