package com.heres.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

private enum class AppSection(val label: String) { CAPSULE("Capsule"), CREATE("Create") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeresRoot(
    vm: MainViewModel = viewModel(),
    onConnectWallet: suspend () -> Result<String>,
    onSignAndSendUnsignedTx: suspend (String) -> Result<String>
) {
    val state by vm.state.collectAsState()
    var section by remember { mutableStateOf(AppSection.CAPSULE) }
    var createSendResult by remember { mutableStateOf<String?>(null) }
    var extendSendResult by remember { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = Color.Transparent,
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xCC0D1728),
                contentColor = Color.White,
                tonalElevation = 0.dp,
                windowInsets = NavigationBarDefaults.windowInsets
            ) {
                AppSection.entries.forEach { item ->
                    NavigationBarItem(
                        selected = section == item,
                        onClick = { section = item },
                        icon = { TabIcon(section = item, active = section == item) },
                        label = { Text(item.label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFF03070F), Color(0xFF091427), Color(0xFF0F1B31), Color(0xFF172742))
                    )
                )
                .padding(padding)
        ) {
            when (section) {
                AppSection.CAPSULE -> CapsuleContent(state, vm, onConnectWallet, onSignAndSendUnsignedTx, extendSendResult) {
                    extendSendResult = it
                }
                AppSection.CREATE -> CreateContent(state, vm, onConnectWallet, onSignAndSendUnsignedTx, createSendResult) {
                    createSendResult = it
                }
            }
        }
    }
}

@Composable
private fun TabIcon(section: AppSection, active: Boolean) {
    val tint = if (active) Mint else Color.White.copy(alpha = 0.55f)
    when (section) {
        AppSection.CAPSULE -> {
            Row(
                modifier = Modifier
                    .size(width = 18.dp, height = 14.dp)
                    .border(1.dp, tint, RoundedCornerShape(8.dp))
                    .padding(horizontal = 3.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Box(modifier = Modifier.size(4.dp).background(tint, RoundedCornerShape(999.dp)))
                Box(modifier = Modifier.size(width = 6.dp, height = 4.dp).background(tint.copy(alpha = 0.8f), RectangleShape))
            }
        }
        AppSection.CREATE -> {
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .border(1.dp, tint, RoundedCornerShape(4.dp)),
                contentAlignment = Alignment.Center
            ) {
                Box(modifier = Modifier.size(width = 9.dp, height = 1.5.dp).background(tint, RectangleShape))
                Box(modifier = Modifier.size(width = 1.5.dp, height = 9.dp).background(tint, RectangleShape))
            }
        }
    }
}

@Composable
private fun GlassPanel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .border(BorderStroke(1.dp, Color(0xFF2B4468)), RoundedCornerShape(22.dp)),
        shape = RoundedCornerShape(22.dp),
        color = Color(0xD10E1C31),
        tonalElevation = 0.dp
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

private fun shortUiError(input: String?, fallback: String): String {
    val raw = input?.trim().orEmpty()
    if (raw.isBlank()) return fallback
    return when {
        raw.contains("iconRelativeUri", ignoreCase = true) -> "지갑 앱 연결 설정 문제입니다. 지갑 앱 업데이트 후 다시 시도해 주세요."
        raw.contains("LifecycleOwner", ignoreCase = true) -> "지갑 연결을 다시 시도해 주세요."
        raw.length > 96 -> raw.take(93) + "..."
        else -> raw
    }
}

@Composable
private fun CapsuleContent(
    state: MainUiState,
    vm: MainViewModel,
    onConnectWallet: suspend () -> Result<String>,
    onSignAndSendUnsignedTx: suspend (String) -> Result<String>,
    extendSendResult: String?,
    onExtendSendResult: (String?) -> Unit
) {
    val scope = rememberCoroutineScope()
    var connectResult by remember { mutableStateOf<String?>(null) }
    val myCapsule = state.capsules.firstOrNull()

    androidx.compose.foundation.lazy.LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("My Capsule", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Seeker native flow (MWA)", color = Color.White.copy(alpha = 0.75f))
        }

        item {
            GlassPanel {
                OutlinedTextField(
                    value = state.wallet,
                    onValueChange = vm::setWallet,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Wallet Address") },
                    singleLine = true
                )
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                val result = onConnectWallet()
                                connectResult = result.fold(
                                    onSuccess = {
                                        vm.setWallet(it)
                                        vm.refresh()
                                        "Connected: ${it.take(4)}...${it.takeLast(4)}"
                                    },
                                    onFailure = { "Connect failed: ${shortUiError(it.message, "지갑 연결 실패")}" }
                                )
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0EA5E9))
                    ) { Text("Select Wallet") }
                    Button(
                        onClick = vm::refresh,
                        modifier = Modifier.weight(1f),
                        enabled = !state.loading,
                        colors = ButtonDefaults.buttonColors(containerColor = Mint)
                    ) { Text(if (state.loading) "Refreshing" else "Refresh") }
                }
                connectResult?.let { Text(it, color = Mint) }
                state.error?.let { Text(shortUiError(it, "요청 실패"), color = Coral, maxLines = 2, overflow = TextOverflow.Ellipsis) }
            }
        }

        item {
            GlassPanel {
                val score = state.activity?.score ?: 0
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(82.dp)) {
                        CircularProgressIndicator(
                            progress = { score / 100f },
                            modifier = Modifier.fillMaxSize(),
                            strokeWidth = 7.dp,
                            color = Mint
                        )
                        Text("$score", fontWeight = FontWeight.Bold)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Activity Health", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                        Text("Tx 24h: ${state.activity?.txCount24h ?: 0}")
                        Text("Token events: ${state.activity?.tokenEvents24h ?: 0}")
                        Text("Action: ${state.activity?.recommendedAction ?: "monitor"}")
                    }
                }
            }
        }

        item {
            GlassPanel {
                if (myCapsule == null) {
                    Text("No capsule yet")
                } else {
                    Text("Address", style = androidx.compose.material3.MaterialTheme.typography.labelMedium)
                    Text(myCapsule.capsuleAddress)
                    Text("Status: ${myCapsule.status}")
                    Text("Next deadline: ${myCapsule.nextInactivityDeadline}")
                    Button(onClick = { vm.loadCapsuleDetail(myCapsule.capsuleAddress) }) {
                        Text("Load detail")
                    }
                }
            }
        }

        if (state.extendPreview?.canExtend == true) {
            item {
                GlassPanel {
                    Text("Extension available")
                    Button(onClick = vm::fakeExtendAction, colors = ButtonDefaults.buttonColors(containerColor = Coral)) {
                        Text("Build Extend Tx")
                    }
                }
            }
        }

        if (state.extendUnsignedTx != null) {
            item {
                GlassPanel {
                    Text("Unsigned update_activity tx ready")
                    Button(onClick = {
                        scope.launch {
                            val result = onSignAndSendUnsignedTx(state.extendUnsignedTx.transactionBase64)
                            onExtendSendResult(
                                result.fold(
                                    { "Sent: $it" },
                                    { "Failed: ${shortUiError(it.message, "서명 또는 전송 실패")}" }
                                )
                            )
                        }
                    }, colors = ButtonDefaults.buttonColors(containerColor = Mint)) {
                        Text("Sign & Send")
                    }
                    extendSendResult?.let { Text(it) }
                }
            }
        }
    }
}

@Composable
private fun CreateContent(
    state: MainUiState,
    vm: MainViewModel,
    onConnectWallet: suspend () -> Result<String>,
    onSignAndSendUnsignedTx: suspend (String) -> Result<String>,
    createSendResult: String?,
    onCreateSendResult: (String?) -> Unit
) {
    val scope = rememberCoroutineScope()
    var connectResult by remember { mutableStateOf<String?>(null) }

    androidx.compose.foundation.lazy.LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Create Capsule", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Native sign flow", color = Color.White.copy(alpha = 0.75f))
        }

        item {
            GlassPanel {
                OutlinedTextField(value = state.wallet, onValueChange = vm::setWallet, modifier = Modifier.fillMaxWidth(), label = { Text("Owner Wallet") }, singleLine = true)
                Button(
                    onClick = {
                        scope.launch {
                            val result = onConnectWallet()
                            connectResult = result.fold(
                                onSuccess = {
                                    vm.setWallet(it)
                                    "Connected: ${it.take(4)}...${it.takeLast(4)}"
                                },
                                onFailure = { "Connect failed: ${shortUiError(it.message, "지갑 연결 실패")}" }
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0EA5E9))
                ) { Text("Select Wallet") }
                connectResult?.let { Text(it, color = Mint) }
                OutlinedTextField(value = state.createForm.intent, onValueChange = vm::updateCreateIntent, modifier = Modifier.fillMaxWidth(), label = { Text("Intent") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = state.createForm.totalSol, onValueChange = vm::updateCreateTotalSol, modifier = Modifier.weight(1f), label = { Text("Total SOL") }, singleLine = true)
                    OutlinedTextField(value = state.createForm.inactivityDays, onValueChange = vm::updateCreateInactivityDays, modifier = Modifier.weight(1f), label = { Text("Days") }, singleLine = true)
                }
                OutlinedTextField(value = state.createForm.beneficiary.address, onValueChange = vm::updateCreateBeneficiaryAddress, modifier = Modifier.fillMaxWidth(), label = { Text("Beneficiary Address") }, singleLine = true)
                OutlinedTextField(value = state.createForm.beneficiary.amountSol, onValueChange = vm::updateCreateBeneficiaryAmount, modifier = Modifier.fillMaxWidth(), label = { Text("Beneficiary SOL") }, singleLine = true)
                Button(onClick = vm::submitCreateCapsuleDraft, modifier = Modifier.fillMaxWidth(), enabled = !state.loading, colors = ButtonDefaults.buttonColors(containerColor = Mint)) {
                    Text(if (state.loading) "Preparing..." else "Build Unsigned Create Tx")
                }
                state.createForm.validationError?.let { Text(it, color = Coral) }
                state.createForm.submitMessage?.let { Text(it) }
            }
        }

        if (state.createForm.unsignedTx != null) {
            item {
                GlassPanel {
                    Text("Unsigned create tx ready")
                    state.createForm.unsignedTx.capsuleAddress?.let { Text("Capsule: $it") }
                    Button(onClick = {
                        scope.launch {
                            val result = onSignAndSendUnsignedTx(state.createForm.unsignedTx.transactionBase64)
                            onCreateSendResult(
                                result.fold(
                                    { "Sent: $it" },
                                    { "Failed: ${shortUiError(it.message, "서명 또는 전송 실패")}" }
                                )
                            )
                        }
                    }, colors = ButtonDefaults.buttonColors(containerColor = Coral)) {
                        Text("Sign & Send")
                    }
                    createSendResult?.let { Text(it) }
                }
            }
        }
    }
}
