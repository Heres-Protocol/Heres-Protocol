package com.heres.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.heres.mobile.data.ActivityScoreResponse
import com.heres.mobile.data.CapsuleDetailResponse
import com.heres.mobile.data.CapsuleListItem
import com.heres.mobile.data.DashboardSummaryResponse
import com.heres.mobile.data.ExtendPreviewResponse
import com.heres.mobile.data.HeresRepository
import com.heres.mobile.data.UnsignedTxResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class BeneficiaryDraft(
    val address: String = "22qQrq3A4fVN5D8PZDAzUjyrByTYnqTTNKFKXrFWh99J",
    val amountSol: String = ""
)

data class CreateCapsuleForm(
    val totalSol: String = "1.0",
    val inactivityDays: String = "30",
    val intent: String = "Mobile capsule",
    val beneficiary: BeneficiaryDraft = BeneficiaryDraft(),
    val validationError: String? = null,
    val submitMessage: String? = null,
    val unsignedTx: UnsignedTxResponse? = null
)

data class MainUiState(
    val wallet: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val dashboardSummary: DashboardSummaryResponse = DashboardSummaryResponse(),
    val dashboardCapsules: List<CapsuleListItem> = emptyList(),
    val activity: ActivityScoreResponse? = null,
    val capsules: List<CapsuleListItem> = emptyList(),
    val selectedCapsule: CapsuleDetailResponse? = null,
    val extendPreview: ExtendPreviewResponse? = null,
    val createForm: CreateCapsuleForm = CreateCapsuleForm(),
    val extendUnsignedTx: UnsignedTxResponse? = null,
    val autoRefreshEnabled: Boolean = true,
    val notificationsEnabled: Boolean = true,
    val capsuleSearch: String = ""
)

class MainViewModel(
    private val repository: HeresRepository = HeresRepository()
) : ViewModel() {
    private val _state = MutableStateFlow(MainUiState())
    val state: StateFlow<MainUiState> = _state.asStateFlow()
    private var restoredWallet = false

    init {
        refresh()
    }

    fun restoreWallet(wallet: String) {
        val normalized = wallet.trim()
        if (normalized.isBlank()) return
        if (restoredWallet && _state.value.wallet == normalized) return
        restoredWallet = true
        _state.value = _state.value.copy(wallet = normalized, error = null)
        refresh()
    }

    fun setWallet(wallet: String) {
        _state.value = _state.value.copy(wallet = wallet.trim(), error = null)
    }

    fun setAutoRefreshEnabled(enabled: Boolean) {
        _state.value = _state.value.copy(autoRefreshEnabled = enabled)
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        _state.value = _state.value.copy(notificationsEnabled = enabled)
    }

    fun setCapsuleSearch(query: String) {
        _state.value = _state.value.copy(capsuleSearch = query)
    }

    fun updateCreateTotalSol(value: String) {
        _state.value = _state.value.copy(
            createForm = _state.value.createForm.copy(totalSol = value, validationError = null, submitMessage = null)
        )
    }

    fun updateCreateInactivityDays(value: String) {
        _state.value = _state.value.copy(
            createForm = _state.value.createForm.copy(inactivityDays = value, validationError = null, submitMessage = null)
        )
    }

    fun updateCreateIntent(value: String) {
        _state.value = _state.value.copy(
            createForm = _state.value.createForm.copy(intent = value, validationError = null, submitMessage = null)
        )
    }

    fun updateCreateBeneficiaryAddress(value: String) {
        val beneficiary = _state.value.createForm.beneficiary.copy(address = value)
        _state.value = _state.value.copy(
            createForm = _state.value.createForm.copy(beneficiary = beneficiary, validationError = null, submitMessage = null)
        )
    }

    fun updateCreateBeneficiaryAmount(value: String) {
        val beneficiary = _state.value.createForm.beneficiary.copy(amountSol = value)
        _state.value = _state.value.copy(
            createForm = _state.value.createForm.copy(beneficiary = beneficiary, validationError = null, submitMessage = null)
        )
    }

    fun submitCreateCapsuleDraft() {
        val form = _state.value.createForm
        val wallet = _state.value.wallet

        if (wallet.isBlank()) {
            _state.value = _state.value.copy(createForm = form.copy(validationError = "Connect or enter wallet first"))
            return
        }

        val totalSol = form.totalSol.toDoubleOrNull()
        val inactivityDays = form.inactivityDays.toIntOrNull()
        val beneficiaryAmount = form.beneficiary.amountSol.toDoubleOrNull()

        if (totalSol == null || totalSol <= 0.0) {
            _state.value = _state.value.copy(createForm = form.copy(validationError = "Total SOL must be > 0"))
            return
        }
        if (inactivityDays == null || inactivityDays <= 0) {
            _state.value = _state.value.copy(createForm = form.copy(validationError = "Inactivity days must be > 0"))
            return
        }
        if (form.beneficiary.address.isBlank()) {
            _state.value = _state.value.copy(createForm = form.copy(validationError = "Beneficiary address is required"))
            return
        }
        if (beneficiaryAmount == null || beneficiaryAmount <= 0.0) {
            _state.value = _state.value.copy(createForm = form.copy(validationError = "Beneficiary amount must be > 0"))
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)

            runCatching {
                repository.buildCreateCapsuleUnsignedTx(
                    owner = wallet,
                    totalSol = form.totalSol,
                    inactivityDays = inactivityDays,
                    beneficiaryAddress = form.beneficiary.address,
                    beneficiaryAmountSol = form.beneficiary.amountSol,
                    intent = form.intent
                )
            }.onSuccess { unsigned ->
                _state.value = _state.value.copy(
                    loading = false,
                    createForm = _state.value.createForm.copy(
                        validationError = null,
                        submitMessage = "Unsigned create tx ready. Sign/send with Solana Mobile Wallet Adapter.",
                        unsignedTx = unsigned
                    )
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    loading = false,
                    createForm = _state.value.createForm.copy(validationError = error.message)
                )
            }
        }
    }

    fun refresh() {
        val wallet = _state.value.wallet.trim()

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching {
                val dashboard = repository.getDashboardCapsulesSafe(wallet.ifBlank { null })
                val activity = if (wallet.isBlank()) null else repository.getActivityScore(wallet)
                val capsules = if (wallet.isBlank()) emptyList() else repository.getMyCapsules(wallet)
                val extend = if (wallet.isBlank()) null else repository.getExtendPreview(wallet)
                Quadruple(dashboard.summary, dashboard.items, activity, Triple(capsules, extend, wallet))
            }.onSuccess { (dashboardSummary, dashboardCapsules, activity, walletData) ->
                val (capsules, extend, activeWallet) = walletData
                _state.value = _state.value.copy(
                    loading = false,
                    dashboardSummary = dashboardSummary,
                    dashboardCapsules = dashboardCapsules,
                    activity = activity,
                    capsules = capsules,
                    extendPreview = extend,
                    selectedCapsule = _state.value.selectedCapsule?.takeIf { detail ->
                        dashboardCapsules.any { it.capsuleAddress == detail.capsuleAddress } ||
                            capsules.any { it.capsuleAddress == detail.capsuleAddress }
                    },
                    wallet = activeWallet,
                    error = null
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(loading = false, error = error.message)
            }
        }
    }

    fun loadCapsuleDetail(address: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching {
                repository.getCapsuleDetail(address)
            }.onSuccess { detail ->
                _state.value = _state.value.copy(loading = false, selectedCapsule = detail)
            }.onFailure { error ->
                _state.value = _state.value.copy(loading = false, error = error.message)
            }
        }
    }

    fun fakeExtendAction() {
        val preview = _state.value.extendPreview ?: return
        if (!preview.canExtend) return

        val wallet = _state.value.wallet
        if (wallet.isBlank()) {
            _state.value = _state.value.copy(error = "Enter wallet address")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            runCatching {
                repository.buildUpdateActivityUnsignedTx(wallet)
            }.onSuccess { unsigned ->
                _state.value = _state.value.copy(
                    loading = false,
                    extendUnsignedTx = unsigned,
                    error = "Unsigned update_activity tx ready (threshold=60)."
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(loading = false, error = error.message)
            }
        }
    }

    fun registerCreatedCapsuleOwner() {
        val wallet = _state.value.wallet.trim()
        if (wallet.isBlank()) return

        viewModelScope.launch {
            runCatching { repository.registerCapsuleOwner(wallet) }
            refresh()
        }
    }
}

private data class Quadruple<A, B, C, D>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D,
)
