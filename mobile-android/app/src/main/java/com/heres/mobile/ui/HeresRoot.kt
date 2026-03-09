package com.heres.mobile.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

private enum class AppSection(val label: String) { HOME("Home"), CREATE("Create"), CAPSULES("Capsules"), SETTINGS("Settings") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeresRoot(
    vm: MainViewModel = viewModel(),
    onConnectWallet: suspend () -> Result<String>,
    onSignAndSendUnsignedTx: suspend (String) -> Result<String>
) {
    val state by vm.state.collectAsState()
    var section by remember { mutableStateOf(AppSection.HOME) }
    var createSendResult by remember { mutableStateOf<String?>(null) }
    var extendSendResult by remember { mutableStateOf<String?>(null) }
    var showOnboarding by rememberSaveable { mutableStateOf(true) }

    val bgAnim = rememberInfiniteTransition(label = "bg")
    val shift by bgAnim.animateFloat(0f, 1200f, infiniteRepeatable(tween(18000, easing = LinearEasing), RepeatMode.Reverse), label = "shift")

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFF050914), Color(0xFF0B1220), Color(0xFF101A2E), Color(0xFF121B36)),
        start = Offset(0f, shift),
        end = Offset(1200f, 1400f - shift)
    )

    Scaffold(
        containerColor = Color.Transparent,
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = {
            NavigationBar {
                AppSection.entries.forEach { item ->
                    NavigationBarItem(
                        selected = section == item,
                        onClick = { section = item },
                        icon = { Dot(isActive = section == item) },
                        label = { Text(item.label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().background(bgBrush).padding(padding)) {
            when (section) {
                AppSection.HOME -> HomeContent(state, vm, onConnectWallet, onSignAndSendUnsignedTx, extendSendResult) { extendSendResult = it }
                AppSection.CREATE -> CreateContent(state, vm, onConnectWallet, onSignAndSendUnsignedTx, createSendResult) { createSendResult = it }
                AppSection.CAPSULES -> CapsulesContent(state, vm)
                AppSection.SETTINGS -> SettingsContent(state, vm)
            }

            AnimatedVisibility(
                visible = showOnboarding,
                enter = fadeIn() + slideInVertically { it / 3 },
                exit = fadeOut() + slideOutVertically { it / 3 },
                modifier = Modifier.fillMaxSize()
            ) {
                OnboardingOverlay(onDismiss = { showOnboarding = false })
            }
        }
    }
}

@Composable
private fun Dot(isActive: Boolean) {
    Box(
        modifier = Modifier.size(8.dp).clip(RoundedCornerShape(999.dp)).background(if (isActive) Mint else Color.White.copy(alpha = 0.25f))
    )
}

@Composable
private fun OnboardingOverlay(onDismiss: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().background(Color(0xDD0B1220)), contentAlignment = Alignment.Center) {
        Surface(shape = RoundedCornerShape(28.dp), color = Color(0xF0182438), modifier = Modifier.padding(20.dp), border = BorderStroke(1.dp, Mint.copy(alpha = 0.35f))) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Welcome to Heres", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium)
                Text("1. Connect wallet\n2. Create capsule\n3. Track activity\n4. Extend timer with one tap")
                Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = Mint)) {
                    Text("Start")
                }
            }
        }
    }
}

@Composable
private fun GlassPanel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .border(BorderStroke(1.dp, Color(0xFF294166)), RoundedCornerShape(24.dp)),
        shape = RoundedCornerShape(24.dp),
        color = Color(0xCC0C1424),
        tonalElevation = 0.dp,
    ) { Column(modifier = Modifier.padding(16.dp), content = content) }
}

@Composable
private fun StatChip(label: String, value: String, tone: Color) {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(tone.copy(alpha = 0.14f)).padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Dot(isActive = true)
        Text(label, style = androidx.compose.material3.MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(value, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

private fun friendlyError(input: String?): String? {
    if (input.isNullOrBlank()) return null
    return when {
        input.contains("404") -> "API 404: 서버 주소를 확인해 주세요."
        input.length > 120 -> input.take(117) + "..."
        else -> input
    }
}

private fun shortUiError(input: String?, fallback: String): String {
    val raw = input?.trim().orEmpty()
    if (raw.isBlank()) return fallback
    return when {
        raw.contains("iconRelativeUri", ignoreCase = true) -> "지갑 앱 연결 설정을 확인해 주세요."
        raw.contains("LifecycleOwner", ignoreCase = true) -> "지갑 연결을 다시 시도해 주세요."
        raw.length > 96 -> raw.take(93) + "..."
        else -> raw
    }
}

@Composable
private fun TrendBars(txCount: Int, tokenEvents: Int) {
    val max = (maxOf(txCount, tokenEvents, 1)).toFloat()
    Canvas(modifier = Modifier.fillMaxWidth().height(54.dp)) {
        val w = size.width
        val h = size.height
        val bw = w / 5f
        val txH = (txCount / max) * h
        val evH = (tokenEvents / max) * h
        drawRoundRect(color = Mint.copy(alpha = 0.75f), topLeft = Offset(bw, h - txH), size = androidx.compose.ui.geometry.Size(bw, txH), cornerRadius = androidx.compose.ui.geometry.CornerRadius(12f, 12f))
        drawRoundRect(color = Coral.copy(alpha = 0.75f), topLeft = Offset(bw * 3f, h - evH), size = androidx.compose.ui.geometry.Size(bw, evH), cornerRadius = androidx.compose.ui.geometry.CornerRadius(12f, 12f))
    }
}

@Composable
private fun HomeContent(
    state: MainUiState,
    vm: MainViewModel,
    onConnectWallet: suspend () -> Result<String>,
    onSignAndSendUnsignedTx: suspend (String) -> Result<String>,
    extendSendResult: String?,
    onExtendSendResult: (String?) -> Unit
) {
    val scope = rememberCoroutineScope()
    var connectResult by remember { mutableStateOf<String?>(null) }
    val txCount = state.activity?.txCount24h ?: 0
    val tokenEvents = state.activity?.tokenEvents24h ?: 0

    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            GlassPanel {
                Text("Signal Dashboard", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium)
                Text("Track wallet vitality and trigger extension safely.")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatChip("Mode", "Seeker Native", Mint)
                    StatChip("Policy", "T60", Coral)
                }
            }
        }

        item {
            GlassPanel {
                OutlinedTextField(value = state.wallet, onValueChange = vm::setWallet, modifier = Modifier.fillMaxWidth(), label = { Text("Wallet Address") }, singleLine = true)
                Row(modifier = Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = {
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
                    }, enabled = !state.loading, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0EA5E9))) { Text("Connect", maxLines = 1) }
                    Button(onClick = vm::refresh, enabled = !state.loading, colors = ButtonDefaults.buttonColors(containerColor = Mint)) { Text(if (state.loading) "Refreshing" else "Refresh", maxLines = 1) }
                }
                Row(modifier = Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = vm::fakeExtendAction,
                        enabled = state.extendPreview?.canExtend == true && !state.loading,
                        colors = ButtonDefaults.buttonColors(containerColor = Coral)
                    ) { Text("Extend", maxLines = 1) }
                }
                connectResult?.let { Text(it, color = Mint, modifier = Modifier.padding(top = 6.dp)) }
                friendlyError(state.error)?.let { Text(it, color = Coral, modifier = Modifier.padding(top = 8.dp), maxLines = 2, overflow = TextOverflow.Ellipsis) }
            }
        }

        item {
            GlassPanel {
                val score = state.activity?.score ?: 0
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(92.dp)) {
                        CircularProgressIndicator(progress = { score / 100f }, modifier = Modifier.fillMaxSize(), strokeWidth = 8.dp, color = Mint)
                        Text("$score", fontWeight = FontWeight.Bold)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Activity Health", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                        Text("Tx 24h: $txCount")
                        Text("Token events: $tokenEvents")
                        Text("Recommendation: ${state.activity?.recommendedAction ?: "monitor"}")
                    }
                }
                TrendBars(txCount = txCount, tokenEvents = tokenEvents)
            }
        }

        if (state.extendUnsignedTx != null) {
            item {
                GlassPanel {
                    Text("Unsigned update_activity tx ready")
                    Text(state.extendUnsignedTx.transactionBase64.take(80) + "...")
                    Button(onClick = {
                        scope.launch {
                            val result = onSignAndSendUnsignedTx(state.extendUnsignedTx.transactionBase64)
                            onExtendSendResult(
                                result.fold(
                                    { "update_activity sent: $it" },
                                    { "update_activity failed: ${shortUiError(it.message, "서명 또는 전송 실패")}" }
                                )
                            )
                        }
                    }, colors = ButtonDefaults.buttonColors(containerColor = Mint)) {
                        Text("Sign & Send Extension")
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

    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            GlassPanel {
                Text("Create Capsule", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium)
                Text("Single SOL flow optimized for reliability.")
            }
        }
        item {
            GlassPanel {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
                        enabled = !state.loading,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0EA5E9))
                    ) {
                        Text("Connect Wallet")
                    }
                    connectResult?.let { Text(it, color = Mint) }
                    OutlinedTextField(value = state.createForm.intent, onValueChange = vm::updateCreateIntent, modifier = Modifier.fillMaxWidth(), label = { Text("Intent") }, singleLine = true)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = state.createForm.totalSol, onValueChange = vm::updateCreateTotalSol, modifier = Modifier.weight(1f), label = { Text("Total SOL") }, singleLine = true)
                        OutlinedTextField(value = state.createForm.inactivityDays, onValueChange = vm::updateCreateInactivityDays, modifier = Modifier.weight(1f), label = { Text("Days") }, singleLine = true)
                    }
                    OutlinedTextField(value = state.createForm.beneficiary.address, onValueChange = vm::updateCreateBeneficiaryAddress, modifier = Modifier.fillMaxWidth(), label = { Text("Beneficiary Address") }, singleLine = true)
                    OutlinedTextField(value = state.createForm.beneficiary.amountSol, onValueChange = vm::updateCreateBeneficiaryAmount, modifier = Modifier.fillMaxWidth(), label = { Text("Beneficiary SOL") }, singleLine = true)

                    Button(onClick = vm::submitCreateCapsuleDraft, enabled = !state.loading, colors = ButtonDefaults.buttonColors(containerColor = Mint)) {
                        Text(if (state.loading) "Preparing..." else "Build Unsigned Create Tx")
                    }

                    state.createForm.validationError?.let { Text(it, color = Coral) }
                    state.createForm.submitMessage?.let { Text(it) }
                }
            }
        }

        if (state.createForm.unsignedTx != null) {
            item {
                GlassPanel {
                    Text("Unsigned create_capsule tx ready")
                    state.createForm.unsignedTx.capsuleAddress?.let { StatChip("Capsule", it, Mint) }
                    Text(state.createForm.unsignedTx.transactionBase64.take(80) + "...")
                    Button(onClick = {
                        scope.launch {
                            val result = onSignAndSendUnsignedTx(state.createForm.unsignedTx.transactionBase64)
                            onCreateSendResult(
                                result.fold(
                                    { "Create sent: $it" },
                                    { "Create failed: ${shortUiError(it.message, "서명 또는 전송 실패")}" }
                                )
                            )
                        }
                    }, colors = ButtonDefaults.buttonColors(containerColor = Coral)) {
                        Text("Sign & Send Create")
                    }
                    createSendResult?.let { Text(it) }
                }
            }
        }
    }
}

@Composable
private fun CapsulesContent(state: MainUiState, vm: MainViewModel) {
    val myCapsule = state.capsules.firstOrNull()

    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            GlassPanel {
                Text("My Capsules", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium)
                Text("Single capsule view optimized for your wallet.")
            }
        }

        if (myCapsule == null) {
            item {
                GlassPanel {
                    Text("No capsule yet", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                    Text("Create one capsule and it will appear here with full details.")
                }
            }
        } else {
            item {
                GlassPanel {
                    Text(myCapsule.capsuleAddress, style = androidx.compose.material3.MaterialTheme.typography.labelMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatChip("Status", myCapsule.status, Mint)
                        StatChip("Inactivity", "${myCapsule.inactivitySeconds}s", Coral)
                    }
                    Text("Last activity: ${myCapsule.lastActivityAt}")
                    Text("Next deadline: ${myCapsule.nextInactivityDeadline}")
                    Button(onClick = { vm.loadCapsuleDetail(myCapsule.capsuleAddress) }) {
                        Text("Open details")
                    }
                }
            }
        }

        item {
            AnimatedVisibility(visible = state.selectedCapsule != null) {
                GlassPanel {
                    val detail = state.selectedCapsule
                    if (detail != null) {
                        Text("Capsule Detail", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                        Text("Address: ${detail.capsuleAddress}")
                        Text("Owner: ${detail.owner}")
                        Text("Status: ${detail.status}")
                        Text("Inactivity(s): ${detail.inactivitySeconds}")
                        Text("Next deadline: ${detail.nextInactivityDeadline}")
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsContent(state: MainUiState, vm: MainViewModel) {
    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            GlassPanel {
                Text("Automation Settings", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium)
                Text("Tune signal polling and extension alerts.")
            }
        }

        item {
            GlassPanel {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Auto refresh signals")
                        Text("Periodic sync for activity score", style = androidx.compose.material3.MaterialTheme.typography.labelMedium)
                    }
                    Switch(checked = state.autoRefreshEnabled, onCheckedChange = vm::setAutoRefreshEnabled)
                }
            }
        }

        item {
            GlassPanel {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Extension notifications")
                        Text("Alert when threshold >= 60", style = androidx.compose.material3.MaterialTheme.typography.labelMedium)
                    }
                    Switch(checked = state.notificationsEnabled, onCheckedChange = vm::setNotificationsEnabled)
                }
            }
        }

        item {
            GlassPanel {
                Text("Design Profile", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                Text("Neo-fintech glass with animated gradients, dense telemetry, and action-forward layout.", textAlign = TextAlign.Start)
            }
        }
    }
}
