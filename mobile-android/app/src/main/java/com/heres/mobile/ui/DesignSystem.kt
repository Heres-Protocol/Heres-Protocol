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

val Mint = Color(0xFF22D3EE)
val Coral = Color(0xFF8B5CF6)
val Ink = Color(0xFF050914)
val Cloud = Color(0xFFF4F8FF)
val Frost = Color(0xFFFFFFFF)

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
    background = Color(0xFF040712),
    surface = Color(0xFF0B1220),
    onPrimary = Color(0xFF031018),
    onSecondary = Color.White,
    onBackground = Color(0xFFEAF3FF),
    onSurface = Color(0xFFEAF3FF),
)

private val HeresTypography = Typography(
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Bold,
        fontSize = 30.sp,
        lineHeight = 34.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
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
