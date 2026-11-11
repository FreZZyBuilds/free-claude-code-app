package dev.fcc.studio

import android.app.Application

class FccApp : Application() {
    lateinit var controller: ServerController
        private set

    override fun onCreate() {
        super.onCreate()
        controller = ServerController(this)
    }
}
