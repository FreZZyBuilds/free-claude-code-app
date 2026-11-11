package dev.fcc.core

import java.io.File

/** Desktop/JVM entrypoint for developing and testing the embedded server. */
fun main(args: Array<String>) {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8082
    val config = File(System.getenv("FCC_MOBILE_CONFIG") ?: "build/fcc-mobile/config.json")
    val ui = (args.firstOrNull() ?: System.getenv("FCC_STUDIO_DIST"))?.let { AssetSource.directory(File(it)) }
    val server = FccServer(config, ui, port, version = "jvm-dev")
    server.onLog = { e -> println("${e.status} ${e.requested} -> ${e.routed ?: "-"} ${e.millis}ms ${e.error ?: ""}") }
    server.start()
    println("FCC mobile core listening on http://127.0.0.1:$port (config: ${config.absolutePath})")
    Runtime.getRuntime().addShutdownHook(Thread { server.stop() })
    Thread.currentThread().join()
}
