package app.stormiq.mobile

/**
 * Phase 2 sketch — Android Auto list UI.
 *
 * Requires:
 *   implementation("androidx.car.app:app:1.4.0") // or current
 *   implementation("androidx.car.app:app-projected:1.4.0")
 *
 * Wire a CarAppService that returns this Session.
 * Fetch live NWS counts the same way the web ThreatStrip does.
 * Prefer actions that open Google Maps rather than custom navigation.
 *
 * This file is intentionally incomplete so it doesn't break a plain phone build.
 * Expand after Phase 1 is on a device.
 */

/*
import androidx.car.app.Session
import androidx.car.app.Screen
import androidx.car.app.model.*

class StormIQSession : Session() {
    override fun onCreateScreen(intent: android.content.Intent): Screen {
        return object : Screen(carContext) {
            override fun onGetTemplate(): Template {
                val list = ItemList.Builder()
                    .addItem(
                        Row.Builder()
                            .setTitle("Storm IQ")
                            .addText("Open phone app for full map · NWS always wins")
                            .build()
                    )
                    .addItem(
                        Row.Builder()
                            .setTitle("Active warnings")
                            .addText("TOR / SVR / FFW counts load here")
                            .build()
                    )
                    .build()

                return ListTemplate.Builder()
                    .setTitle("Storm IQ")
                    .setSingleList(list)
                    .build()
            }
        }
    }
}
*/
