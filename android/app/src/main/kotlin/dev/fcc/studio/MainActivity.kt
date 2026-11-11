package dev.fcc.studio

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.fcc.core.RequestLogEntry

private val Ink = Color(0xFF0E1524)
private val Surface = Color(0xFF141C2E)
private val Raised = Color(0xFF1A2337)
private val Line = Color(0xFF253049)
private val Fg = Color(0xFFE8ECF5)
private val Muted = Color(0xFFA3ADC4)
private val Faint = Color(0xFF6E7892)
private val Cobalt = Color(0xFF3651F5)
private val Go = Color(0xFF18A07E)
private val Stop = Color(0xFFE0474C)
private val Amber = Color(0xFFE8A23A)

class MainActivity : ComponentActivity() {
    private val controller get() = (application as FccApp).controller

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        // Start either way: without the permission the service still runs, only the notification is hidden.
        controller.requestStart()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Cobalt, background = Ink, surface = Surface)) {
                val state by controller.state.collectAsStateWithLifecycle()
                val log by controller.log.collectAsStateWithLifecycle()
                HomeScreen(
                    state = state,
                    log = log,
                    port = controller.port,
                    onPort = { controller.port = it },
                    onPlay = ::play,
                    onStop = controller::requestStop,
                    onOpenStudio = { path -> (state as? ServerState.Running)?.let { startActivity(StudioActivity.intent(this, it.port, path)) } },
                    onCopy = ::copy,
                    onDismissError = controller::clearError,
                )
            }
        }
    }

    private fun play() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            controller.requestStart()
        }
    }

    private fun copy(text: String) {
        getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("FCC", text))
        if (Build.VERSION.SDK_INT < 33) Toast.makeText(this, "Kopiert", Toast.LENGTH_SHORT).show()
    }
}

@Composable
private fun HomeScreen(
    state: ServerState,
    log: List<RequestLogEntry>,
    port: Int,
    onPort: (Int) -> Unit,
    onPlay: () -> Unit,
    onStop: () -> Unit,
    onOpenStudio: (String) -> Unit,
    onCopy: (String) -> Unit,
    onDismissError: () -> Unit,
) {
    val running = state is ServerState.Running
    Column(
        Modifier
            .fillMaxSize()
            .background(Ink)
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(RoundedCornerShape(9.dp)).background(Cobalt), contentAlignment = Alignment.Center) {
                Icon(painterResource(R.drawable.ic_notification), contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column {
                Text("FCC Studio", color = Fg, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                Text("Free Claude Code für Android", color = Faint, fontSize = 12.sp)
            }
        }

        Spacer(Modifier.height(44.dp))
        PlayButton(state, onPlay, onStop)
        Spacer(Modifier.height(22.dp))

        val (title, subtitle) = when (state) {
            ServerState.Stopped -> "Server ist aus" to "Tippe auf Play, um den lokalen Server zu starten."
            ServerState.Starting -> "Startet…" to "Der Server öffnet Port $port."
            is ServerState.Running -> "Server läuft" to "http://127.0.0.1:${state.port}"
            is ServerState.Failed -> "Start fehlgeschlagen" to state.message
        }
        Text(title, color = Fg, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        Text(
            subtitle,
            color = if (state is ServerState.Failed) Stop else Muted,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
            fontFamily = if (running) FontFamily.Monospace else FontFamily.Default,
        )
        if (state is ServerState.Failed) {
            Spacer(Modifier.height(8.dp))
            Text("OK", color = Cobalt, modifier = Modifier.clickable(onClick = onDismissError).padding(8.dp))
        }

        if (state == ServerState.Stopped || state is ServerState.Failed) {
            Spacer(Modifier.height(20.dp))
            PortField(port, onPort)
        }

        if (running) {
            Spacer(Modifier.height(28.dp))
            Button(
                onClick = { onOpenStudio("/") },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Cobalt),
            ) { Text("Studio öffnen", fontSize = 16.sp, fontWeight = FontWeight.Medium) }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = { onOpenStudio("/providers") }, modifier = Modifier.weight(1f).height(46.dp), shape = RoundedCornerShape(12.dp)) {
                    Text("Provider", color = Fg)
                }
                OutlinedButton(onClick = { onOpenStudio("/playground") }, modifier = Modifier.weight(1f).height(46.dp), shape = RoundedCornerShape(12.dp)) {
                    Text("Playground", color = Fg)
                }
            }
            Spacer(Modifier.height(24.dp))
            ConnectCard((state as ServerState.Running).port, onCopy)
            Spacer(Modifier.height(16.dp))
            LogCard(log)
        } else {
            Spacer(Modifier.height(32.dp))
            InfoCard()
        }
    }
}

@Composable
private fun PlayButton(state: ServerState, onPlay: () -> Unit, onStop: () -> Unit) {
    val running = state is ServerState.Running
    val starting = state is ServerState.Starting
    val pulse = rememberInfiniteTransition(label = "pulse")
    val ring by pulse.animateFloat(1f, 1.18f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "ring")
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(200.dp)) {
        if (running) {
            Box(Modifier.size(172.dp).scale(ring).clip(CircleShape).background(Go.copy(alpha = 0.14f)))
        }
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(168.dp)
                .clip(CircleShape)
                .background(if (running) Raised else Cobalt)
                .border(2.dp, if (running) Go else Cobalt, CircleShape)
                .clickable(enabled = !starting) { if (running) onStop() else onPlay() }
                .semantics {
                    role = Role.Button
                    contentDescription = if (running) "Server stoppen" else "Server starten"
                },
        ) {
            when {
                starting -> CircularProgressIndicator(color = Color.White, strokeWidth = 4.dp, modifier = Modifier.size(56.dp))
                running -> Box(Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)).background(Stop))
                else -> Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = Color.White, modifier = Modifier.size(96.dp))
            }
        }
    }
}

@Composable
private fun PortField(port: Int, onPort: (Int) -> Unit) {
    var text by remember { mutableStateOf(port.toString()) }
    OutlinedTextField(
        value = text,
        onValueChange = { v ->
            text = v.filter(Char::isDigit).take(5)
            text.toIntOrNull()?.takeIf { it in 1024..65535 }?.let(onPort)
        },
        label = { Text("Port") },
        singleLine = true,
        isError = text.toIntOrNull()?.let { it !in 1024..65535 } ?: true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.width(160.dp),
        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Fg, unfocusedTextColor = Fg, unfocusedBorderColor = Line),
    )
}

@Composable
private fun Card(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Surface).border(1.dp, Line, RoundedCornerShape(14.dp)).padding(16.dp),
    ) { content() }
}

@Composable
private fun ConnectCard(port: Int, onCopy: (String) -> Unit) {
    val cmd = "export ANTHROPIC_BASE_URL=http://127.0.0.1:$port\nexport ANTHROPIC_AUTH_TOKEN=fcc\nclaude"
    Card {
        Text("Claude Code verbinden", color = Fg, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Spacer(Modifier.height(4.dp))
        Text("In Termux auf diesem Gerät ausführen:", color = Muted, fontSize = 14.sp)
        Spacer(Modifier.height(10.dp))
        Text(
            cmd,
            color = Fg,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp,
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(9.dp)).background(Raised).padding(12.dp),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedButton(onClick = { onCopy(cmd) }, shape = RoundedCornerShape(10.dp)) { Text("Befehl kopieren", color = Fg) }
    }
}

@Composable
private fun LogCard(log: List<RequestLogEntry>) {
    Card {
        Text("Letzte Anfragen", color = Fg, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Spacer(Modifier.height(8.dp))
        if (log.isEmpty()) {
            Text("Noch keine. Sende eine Nachricht im Playground oder aus Claude Code.", color = Muted, fontSize = 14.sp)
        }
        log.take(8).forEach { e ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(if (e.status == 200) Go else if (e.status == 429) Amber else Stop))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(e.requested, color = Fg, fontSize = 13.sp, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        e.error ?: "→ ${e.routed}",
                        color = if (e.error != null) Stop else Faint,
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text("${e.millis} ms", color = Faint, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun InfoCard() {
    Card {
        Text("So funktioniert's", color = Fg, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Spacer(Modifier.height(8.dp))
        listOf(
            "Play startet einen Server direkt in dieser App, nur auf diesem Gerät erreichbar (127.0.0.1).",
            "Im Studio trägst du API-Keys ein (z. B. NVIDIA NIM oder OpenRouter, beide mit Gratis-Kontingent) und legst fest, welches Modell Opus, Sonnet und Haiku bedient.",
            "Claude Code in Termux schickt seine Anfragen dann an diesen Server.",
        ).forEachIndexed { i, s ->
            Row(Modifier.padding(vertical = 4.dp)) {
                Text("${i + 1}", color = Cobalt, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(20.dp))
                Text(s, color = Muted, fontSize = 14.sp)
            }
        }
    }
}
