package com.heres.mobile.ui

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Mint = Color(0xFF33D2FF)
val Coral = Color(0xFFFF9A3D)
val Ink = Color(0xFF050913)
val Cloud = Color(0xFFF4F7FF)
val Frost = Color(0xFFFFFFFF)
val Panel = Color(0xFF0F1B2D)
val PanelSoft = Color(0xFF13243B)
val Mist = Color(0xFFD9E5FF)

private val HeresLightColors: ColorScheme = lightColorScheme(
    primary = Mint,
    secondary = Coral,
    background = Cloud,
    surface = Frost,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Ink,
    onSurface = Ink,
)

private val HeresDarkColors: ColorScheme = darkColorScheme(
    primary = Mint,
    secondary = Coral,
    background = Color(0xFF050A16),
    surface = Panel,
    onPrimary = Color(0xFF031018),
    onSecondary = Color.White,
    onBackground = Mist,
    onSurface = Mist,
)

private val HeresTypography = Typography(
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        lineHeight = 36.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp
    ),
)

@Composable
fun HeresTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        // Lock to dark palette to match heres.vercel.app look and feel.
        colorScheme = HeresDarkColors,
        typography = HeresTypography,
        content = content,
    )
}
