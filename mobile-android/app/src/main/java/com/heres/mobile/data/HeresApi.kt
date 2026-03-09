package com.heres.mobile.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface HeresApi {
    @GET("api/mobile/dashboard")
    suspend fun getDashboardCapsules(@Query("wallet") wallet: String? = null): DashboardCapsulesResponse

    @GET("api/mobile/activity-score")
    suspend fun getActivityScore(@Query("wallet") wallet: String): ActivityScoreResponse

    @GET("api/mobile/capsules")
    suspend fun getMyCapsules(@Query("wallet") wallet: String): CapsulesResponse

    @GET("api/mobile/capsules/{address}")
    suspend fun getCapsuleDetail(@Path("address") address: String): CapsuleDetailResponse

    @POST("api/mobile/extend-preview")
    suspend fun getExtendPreview(@Body request: ExtendPreviewRequest): ExtendPreviewResponse

    @POST("api/mobile/tx/create-capsule")
    suspend fun buildCreateCapsuleUnsignedTx(@Body request: CreateCapsuleUnsignedRequest): UnsignedTxResponse

    @POST("api/mobile/tx/update-activity")
    suspend fun buildUpdateActivityUnsignedTx(@Body request: UpdateActivityUnsignedRequest): UnsignedTxResponse

    @POST("api/capsule-registry")
    suspend fun registerCapsuleOwner(@Body request: RegisterCapsuleOwnerRequest)
}
