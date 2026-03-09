package com.heres.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.heres.mobile.R
import com.heres.mobile.data.CapsuleDetailResponse
import com.heres.mobile.data.CapsuleListItem
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private enum class AppSection(val label: String) {
    DASHBOARD("Dashboard"),
    CAPSULE("My Capsule"),
    CREATE("Create")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeresRoot(
    vm: MainViewModel = viewModel(),
    initialWallet: String? = null,
    onWalletConnected: (String) -> Unit = {},
    onConnectWallet: suspend () -> Result<String>,
    onSignAndSendUnsignedTx: suspend (String) -> Result<String>
) {
    val state by vm.state.collectAsState()
    var section by rememberSaveable { mutableStateOf(AppSection.DASHBOARD) }
    var createSendResult by remember { mutableStateOf<String?>(null) }
    var extendSendResult by remember { mutableStateOf<String?>(null) }
    var showSplash by rememberSaveable { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        delay(1150)
        showSplash = false
    }

    LaunchedEffect(initialWallet) {
        if (!initialWallet.isNullOrBlank()) {
            vm.restoreWallet(initialWallet)
        }
    }

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
                AppSection.DASHBOARD -> DashboardContent(state, vm, onConnectWallet, onWalletConnected)
                AppSection.CAPSULE -> CapsuleContent(state, vm, onConnectWallet, onWalletConnected, onSignAndSendUnsignedTx, extendSendResult) {
                    extendSendResult = it
                }
                AppSection.CREATE -> CreateContent(state, vm, onConnectWallet, onWalletConnected, onSignAndSendUnsignedTx, createSendResult) {
                    createSendResult = it
                }
            }

            if (showSplash) {
                SplashOverlay()
            }
        }
    }
}

@Composable
private fun TabIcon(section: AppSection, active: Boolean) {
    val tint = if (active) Mint else Color.White.copy(alpha = 0.55f)
    when (section) {
        AppSection.DASHBOARD -> {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Box(
                    modifier = Modifier
                        .size(width = 5.dp, height = 12.dp)
                        .background(tint, RoundedCornerShape(2.dp))
                )
                Box(
                    modifier = Modifier
                        .size(width = 5.dp, height = 16.dp)
                        .background(tint, RoundedCornerShape(2.dp))
                )
                Box(
                    modifier = Modifier
                        .size(width = 5.dp, height = 9.dp)
                        .background(tint, RoundedCornerShape(2.dp))
                )
            }
        }
        AppSection.CAPSULE -> {
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .border(1.dp, tint, RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center
            ) {
                Box(modifier = Modifier.size(6.dp).background(tint, RoundedCornerShape(99.dp)))
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
private fun SplashOverlay() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF18314D), Color(0xFF08111E), Color(0xFF040811)),
                    radius = 1200f
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(164.dp)
                    .clip(RoundedCornerShape(40.dp))
                    .background(Color(0xAA0F1B2D))
                    .border(1.dp, Color(0x3D33D2FF), RoundedCornerShape(40.dp)),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_launcher_foreground),
                    contentDescription = "Heres logo",
                    modifier = Modifier.size(116.dp)
                )
            }
            Text("Heres", color = Mint, fontWeight = FontWeight.Bold)
            Text("Loading live capsule dashboard", color = Color.White, fontWeight = FontWeight.Bold)
            Text(
                "Preparing all capsules and your wallet overview.",
                color = Color.White.copy(alpha = 0.72f)
            )
            LinearProgressIndicator(
                modifier = Modifier
                    .width(188.dp)
                    .clip(RoundedCornerShape(99.dp)),
                color = Mint,
                trackColor = Color.White.copy(alpha = 0.12f)
            )
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
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            content = content
        )
    }
}

private fun shortUiError(input: String?, fallback: String): String {
    val raw = input?.trim().orEmpty()
    if (raw.isBlank()) return fallback
    return when {
        raw.contains("iconRelativeUri", ignoreCase = true) -> "There is a wallet app configuration issue. Update the wallet app and try again."
        raw.contains("LifecycleOwner", ignoreCase = true) -> "Please try connecting the wallet again."
        raw.length > 96 -> raw.take(93) + "..."
        else -> raw
    }
}

@Composable
private fun DashboardContent(
    state: MainUiState,
    vm: MainViewModel,
    onConnectWallet: suspend () -> Result<String>,
    onWalletConnected: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var connectResult by remember { mutableStateOf<String?>(null) }
    val wallet = state.wallet.trim()
    val filteredCapsules = remember(state.dashboardCapsules, state.capsuleSearch, wallet) {
        val query = state.capsuleSearch.trim().lowercase(Locale.getDefault())
        state.dashboardCapsules.filter { capsule ->
            if (query.isBlank()) return@filter true
            capsule.capsuleAddress.lowercase(Locale.getDefault()).contains(query) ||
                capsule.owner.lowercase(Locale.getDefault()).contains(query) ||
                capsule.status.lowercase(Locale.getDefault()).contains(query)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            SectionTitle(
                eyebrow = "Default Home",
                title = "Live Capsule Dashboard",
                subtitle = "Browse every capsule first. If a wallet is already connected, your capsule stays highlighted automatically."
            )
        }

        item {
            GlassPanel {
                Text("Wallet", color = Color.White.copy(alpha = 0.7f))
                OutlinedTextField(
                    value = state.wallet,
                    onValueChange = vm::setWallet,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Wallet address") },
                    singleLine = true
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                val result = onConnectWallet()
                                connectResult = result.fold(
                                    onSuccess = {
                                        vm.setWallet(it)
                                        onWalletConnected(it)
                                        vm.refresh()
                                        "Connected: ${maskAddress(it)}"
                                    },
                                    onFailure = { "Connect failed: ${shortUiError(it.message, "Wallet connection failed")}" }
                                )
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Mint)
                    ) {
                        Text("Select Wallet")
                    }
                    OutlinedButton(
                        onClick = vm::refresh,
                        modifier = Modifier.weight(1f),
                        enabled = !state.loading
                    ) {
                        Text(if (state.loading) "Syncing" else "Refresh")
                    }
                }
                connectResult?.let { Text(it, color = Mint) }
                if (state.wallet.isNotBlank()) {
                    Text("Last approved wallet: ${maskAddress(state.wallet)}", color = Color.White.copy(alpha = 0.56f))
                }
                state.error?.let { Text(shortUiError(it, "Request failed"), color = Coral, maxLines = 2, overflow = TextOverflow.Ellipsis) }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                SummaryChip("Total", state.dashboardSummary.total.toString())
                SummaryChip("Active", state.dashboardSummary.active.toString())
                SummaryChip("Executed", state.dashboardSummary.executed.toString())
                SummaryChip("Expired", state.dashboardSummary.expired.toString())
            }
        }

        item {
            GlassPanel {
                Text("Search", fontWeight = FontWeight.SemiBold, color = Color.White)
                OutlinedTextField(
                    value = state.capsuleSearch,
                    onValueChange = vm::setCapsuleSearch,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Capsule address, owner, status") },
                    singleLine = true
                )
                Text("${filteredCapsules.size} capsules visible", color = Color.White.copy(alpha = 0.72f))
            }
        }

        if (state.selectedCapsule != null) {
            item {
                CapsuleDetailPanel(title = "Selected Capsule", detail = state.selectedCapsule)
            }
        }

        if (filteredCapsules.isEmpty()) {
            item {
                GlassPanel {
                    Text("No capsules found", color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text("No capsules have been indexed yet, or your search returned no matches.", color = Color.White.copy(alpha = 0.72f))
                }
            }
        }

        items(filteredCapsules, key = { it.capsuleAddress }) { capsule ->
            DashboardCapsuleCard(
                capsule = capsule,
                isMine = wallet.isNotBlank() && capsule.owner == wallet,
                onOpen = { vm.loadCapsuleDetail(capsule.capsuleAddress) }
            )
        }
    }
}

@Composable
private fun CapsuleContent(
    state: MainUiState,
    vm: MainViewModel,
    onConnectWallet: suspend () -> Result<String>,
    onWalletConnected: (String) -> Unit,
    onSignAndSendUnsignedTx: suspend (String) -> Result<String>,
    extendSendResult: String?,
    onExtendSendResult: (String?) -> Unit
) {
    val scope = rememberCoroutineScope()
    var connectResult by remember { mutableStateOf<String?>(null) }
    val myCapsule = state.capsules.firstOrNull()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            SectionTitle(
                eyebrow = "Wallet Focus",
                title = "My Capsule",
                subtitle = "Stay focused on your own capsule, activity signal, and extend action."
            )
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
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                val result = onConnectWallet()
                                connectResult = result.fold(
                                    onSuccess = {
                                        vm.setWallet(it)
                                        onWalletConnected(it)
                                        vm.refresh()
                                        "Connected: ${maskAddress(it)}"
                                    },
                                    onFailure = { "Connect failed: ${shortUiError(it.message, "Wallet connection failed")}" }
                                )
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0EA5E9))
                    ) { Text("Select Wallet") }
                    OutlinedButton(
                        onClick = vm::refresh,
                        modifier = Modifier.weight(1f),
                        enabled = !state.loading
                    ) { Text(if (state.loading) "Refreshing" else "Refresh") }
                }
                connectResult?.let { Text(it, color = Mint) }
                state.error?.let { Text(shortUiError(it, "Request failed"), color = Coral, maxLines = 2, overflow = TextOverflow.Ellipsis) }
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
                        Text("Tx 24h: ${state.activity?.txCount24h ?: 0}", color = Color.White.copy(alpha = 0.76f))
                        Text("Token events: ${state.activity?.tokenEvents24h ?: 0}", color = Color.White.copy(alpha = 0.76f))
                        Text("Action: ${state.activity?.recommendedAction ?: "monitor"}", color = Color.White.copy(alpha = 0.76f))
                    }
                }
            }
        }

        item {
            if (myCapsule == null) {
                GlassPanel {
                    Text("No capsule yet", color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text("Connect a wallet and create a capsule to manage it here.", color = Color.White.copy(alpha = 0.72f))
                }
            } else {
                DashboardCapsuleCard(
                    capsule = myCapsule,
                    isMine = true,
                    onOpen = { vm.loadCapsuleDetail(myCapsule.capsuleAddress) }
                )
            }
        }

        if (state.selectedCapsule != null) {
            item {
                CapsuleDetailPanel(title = "Capsule Detail", detail = state.selectedCapsule)
            }
        }

        if (state.extendPreview?.canExtend == true) {
            item {
                GlassPanel {
                    Text("Extension available", color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text(state.extendPreview.reason, color = Color.White.copy(alpha = 0.72f))
                    Button(
                        onClick = vm::fakeExtendAction,
                        colors = ButtonDefaults.buttonColors(containerColor = Coral)
                    ) {
                        Text("Build Extend Tx")
                    }
                }
            }
        }

        if (state.extendUnsignedTx != null) {
            item {
                GlassPanel {
                    Text("Unsigned update_activity tx ready", color = Color.White, fontWeight = FontWeight.SemiBold)
                    Button(
                        onClick = {
                            scope.launch {
                                val result = onSignAndSendUnsignedTx(state.extendUnsignedTx.transactionBase64)
                                onExtendSendResult(
                                    result.fold(
                                        { "Sent: $it" },
                                        { "Failed: ${shortUiError(it.message, "Signing or send failed")}" }
                                    )
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Mint)
                    ) {
                        Text("Sign & Send")
                    }
                    extendSendResult?.let { Text(it, color = Mint) }
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
    onWalletConnected: (String) -> Unit,
    onSignAndSendUnsignedTx: suspend (String) -> Result<String>,
    createSendResult: String?,
    onCreateSendResult: (String?) -> Unit
) {
    val scope = rememberCoroutineScope()
    var connectResult by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            SectionTitle(
                eyebrow = "Native Flow",
                title = "Create Capsule",
                subtitle = "Build a capsule with the same sign-and-send flow, without overloading the screen."
            )
        }

        item {
            GlassPanel {
                OutlinedTextField(
                    value = state.wallet,
                    onValueChange = vm::setWallet,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Owner Wallet") },
                    singleLine = true
                )
                Button(
                    onClick = {
                        scope.launch {
                            val result = onConnectWallet()
                            connectResult = result.fold(
                                onSuccess = {
                                    vm.setWallet(it)
                                    onWalletConnected(it)
                                    "Connected: ${maskAddress(it)}"
                                },
                                onFailure = { "Connect failed: ${shortUiError(it.message, "Wallet connection failed")}" }
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0EA5E9))
                ) { Text("Select Wallet") }
                connectResult?.let { Text(it, color = Mint) }

                OutlinedTextField(
                    value = state.createForm.intent,
                    onValueChange = vm::updateCreateIntent,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Intent") },
                    singleLine = true
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = state.createForm.totalSol,
                        onValueChange = vm::updateCreateTotalSol,
                        modifier = Modifier.weight(1f),
                        label = { Text("Total SOL") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = state.createForm.inactivityDays,
                        onValueChange = vm::updateCreateInactivityDays,
                        modifier = Modifier.weight(1f),
                        label = { Text("Days") },
                        singleLine = true
                    )
                }
                OutlinedTextField(
                    value = state.createForm.beneficiary.address,
                    onValueChange = vm::updateCreateBeneficiaryAddress,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Beneficiary Address") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = state.createForm.beneficiary.amountSol,
                    onValueChange = vm::updateCreateBeneficiaryAmount,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Beneficiary SOL") },
                    singleLine = true
                )
                Button(
                    onClick = vm::submitCreateCapsuleDraft,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.loading,
                    colors = ButtonDefaults.buttonColors(containerColor = Mint)
                ) {
                    Text(if (state.loading) "Preparing..." else "Build Unsigned Create Tx")
                }
                state.createForm.validationError?.let { Text(it, color = Coral) }
                state.createForm.submitMessage?.let { Text(it, color = Mint) }
            }
        }

        if (state.createForm.unsignedTx != null) {
            item {
                GlassPanel {
                    Text("Unsigned create tx ready", color = Color.White, fontWeight = FontWeight.SemiBold)
                    state.createForm.unsignedTx.capsuleAddress?.let { Text("Capsule: $it", color = Color.White.copy(alpha = 0.76f)) }
                    Button(
                        onClick = {
                            scope.launch {
                                val result = onSignAndSendUnsignedTx(state.createForm.unsignedTx.transactionBase64)
                                onCreateSendResult(
                                    result.fold(
                                        {
                                            vm.registerCreatedCapsuleOwner()
                                            "Sent: $it"
                                        },
                                        { "Failed: ${shortUiError(it.message, "Signing or send failed")}" }
                                    )
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Coral)
                    ) {
                        Text("Sign & Send")
                    }
                    createSendResult?.let { Text(it, color = Mint) }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(eyebrow: String, title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(eyebrow, color = Mint, fontWeight = FontWeight.Bold)
        Text(title, style = androidx.compose.material3.MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(subtitle, color = Color.White.copy(alpha = 0.72f))
    }
}

@Composable
private fun SummaryChip(label: String, value: String) {
    GlassPanel(modifier = Modifier.width(124.dp)) {
        Text(label, color = Color.White.copy(alpha = 0.7f))
        Text(value, color = Color.White, fontWeight = FontWeight.Bold, style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
    }
}

@Composable
private fun DashboardCapsuleCard(
    capsule: CapsuleListItem,
    isMine: Boolean,
    onOpen: () -> Unit
) {
    GlassPanel(modifier = Modifier.clickable(onClick = onOpen)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    StatusPill(capsule.status)
                    if (isMine) {
                        MinePill()
                    }
                }
                Text(maskAddress(capsule.capsuleAddress), color = Color.White, fontWeight = FontWeight.SemiBold)
                Text(maskAddress(capsule.owner), color = Color.White.copy(alpha = 0.72f))
            }
            Text("Open", color = Mint, fontWeight = FontWeight.SemiBold)
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            CapsuleMeta("Last Activity", formatTimestamp(capsule.lastActivityAt))
            CapsuleMeta("Deadline", formatTimestamp(capsule.nextInactivityDeadline))
        }
    }
}

@Composable
private fun CapsuleDetailPanel(title: String, detail: CapsuleDetailResponse) {
    GlassPanel {
        Text(title, color = Color.White, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            StatusPill(detail.status)
            if (detail.isActive) {
                MinePill(label = "Active")
            }
        }
        CapsuleMeta("Capsule", detail.capsuleAddress)
        CapsuleMeta("Owner", detail.owner)
        CapsuleMeta("Last Activity", formatTimestamp(detail.lastActivityAt))
        CapsuleMeta("Executed At", formatTimestamp(detail.executedAt))
        CapsuleMeta("Next Deadline", formatTimestamp(detail.nextInactivityDeadline))
        CapsuleMeta("Inactivity", "${detail.inactivitySeconds} sec")
    }
}

@Composable
private fun CapsuleMeta(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, color = Color.White.copy(alpha = 0.6f))
        Text(value, color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun StatusPill(status: String) {
    val normalized = status.lowercase(Locale.getDefault())
    val tone = when {
        normalized.contains("active") -> Mint
        normalized.contains("executed") -> Color(0xFF8F7BFF)
        normalized.contains("expired") -> Coral
        else -> Color.White.copy(alpha = 0.72f)
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(99.dp))
            .background(tone.copy(alpha = 0.18f))
            .border(1.dp, tone.copy(alpha = 0.42f), RoundedCornerShape(99.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(status.replaceFirstChar { it.uppercase() }, color = tone, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun MinePill(label: String = "Mine") {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(99.dp))
            .background(Color.White.copy(alpha = 0.09f))
            .border(1.dp, Color.White.copy(alpha = 0.14f), RoundedCornerShape(99.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(label, color = Color.White, fontWeight = FontWeight.SemiBold)
    }
}

private fun maskAddress(address: String): String {
    return if (address.length <= 10) address else "${address.take(4)}...${address.takeLast(4)}"
}

private fun formatTimestamp(timestampMs: Long?): String {
    if (timestampMs == null || timestampMs <= 0L) return "-"
    return runCatching {
        SimpleDateFormat("MM/dd HH:mm", Locale.getDefault()).format(Date(timestampMs))
    }.getOrDefault(timestampMs.toString())
}
