package mn.alkhaach.steps

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Утас дахин асах эсвэл апп шинэчлэгдэхэд (сервис зогсдог) тоолуурыг сэргээнэ. */
class StepBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED ->
        StepCounterService.startIfEnabled(context)
    }
  }
}
