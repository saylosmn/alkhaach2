package mn.alkhaach.steps

import android.content.Context
import android.content.Intent
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS ↔ дэвсгэрийн алхам тоолуур. Тайлбарыг modules/alkhaach-steps/index.ts-ээс үзнэ үү. */
class AlkhaachStepsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AlkhaachSteps")

    Function<Boolean>("isSupported") { StepCounterService.hasSensor(context) }

    Function<Boolean>("isEnabled") { StepStore.isEnabled(context) }

    // ACTIVITY_RECOGNITION зөвшөөрлийг JS тал өмнө нь авсан байх ёстой
    AsyncFunction("start") { baseUrl: String?, token: String? ->
      StepStore.enable(context, baseUrl, token)
      val started = StepCounterService.startIfEnabled(context)
      if (!started) StepStore.disable(context)
      started
    }

    AsyncFunction<Unit>("stop") {
      StepStore.disable(context)
      context.stopService(Intent(context, StepCounterService::class.java))
    }

    // Апп нээгдэх бүрт: OS эсвэл хэрэглэгч (force stop) зогсоосон бол дахин асаана
    AsyncFunction<Boolean>("ensureRunning") { StepCounterService.startIfEnabled(context) }

    AsyncFunction("setAuth") { token: String? -> StepStore.setToken(context, token) }

    AsyncFunction<List<Map<String, Any>>>("getDays") {
      StepStore.recentDays(context, 14).map { (date, steps) ->
        mapOf("local_date" to date, "steps" to steps.toInt())
      }
    }

    AsyncFunction("raiseDay") { date: String, steps: Int ->
      StepStore.raiseDay(context, date, steps.toLong())
    }
  }
}
