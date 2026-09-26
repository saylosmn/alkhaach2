package mn.alkhaach.steps

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Апп хаалттай үед алхам тоолох foreground service.
 *
 * Утасны TYPE_STEP_COUNTER мэдрэгч нь бага зарцуулалттай, hardware дээр тоолдог бөгөөд
 * асаснаас хойшхи нийлбэрийг өгдөг. Сервис тэр утгыг өдөр бүрээр хувааж [StepStore]-д
 * хадгална; апп нээгдэхэд эсвэл 15 минут тутам сервер рүү илгээнэ.
 * Мэдэгдлийн самбарт өнөөдрийн алхамыг харуулна (Android foreground service-д заавал).
 */
class StepCounterService : Service(), SensorEventListener {
  private val handler = Handler(Looper.getMainLooper())
  private var uploader: ExecutorService? = null
  private var sensorManager: SensorManager? = null
  private var shownSteps = -1L
  private var shownAt = 0L

  private val tick = object : Runnable {
    override fun run() {
      // Шөнө дундын дараа алхамгүй байсан ч мэдэгдэл шинэ өдрийн тоог харуулна
      showSteps(StepStore.todaySteps(this@StepCounterService), force = true)
      uploader?.let { StepUploader.upload(applicationContext, it) }
      handler.postDelayed(this, TICK_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // startForegroundService() дуудлага бүрийн дараа startForeground заавал дуудагдах ёстой
    if (!goForeground()) {
      stopSelf()
      return START_NOT_STICKY
    }
    if (!StepStore.isEnabled(this) || !register()) {
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    sensorManager?.unregisterListener(this)
    sensorManager = null
    uploader?.shutdown()
    uploader = null
    StepStore.flush(this)
    super.onDestroy()
  }

  override fun onSensorChanged(event: SensorEvent) {
    val raw = event.values.firstOrNull()?.toLong() ?: return
    val today = StepStore.recordCounter(this, raw, wallClockOf(event.timestamp))
    showSteps(today, force = false)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  private fun register(): Boolean {
    if (sensorManager != null) return true
    val sm = getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return false
    val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return false
    // Batch-аар (10 сек хүртэл) авна — CPU-г алхам бүрт сэрээхгүй
    if (!sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL, REPORT_LATENCY_US)) {
      return false
    }
    sensorManager = sm
    uploader = Executors.newSingleThreadExecutor()
    handler.postDelayed(tick, TICK_MS)
    return true
  }

  private fun goForeground(): Boolean =
    try {
      ensureChannel()
      val steps = StepStore.todaySteps(this)
      val notification = buildNotification(steps)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      shownSteps = steps
      shownAt = System.currentTimeMillis()
      true
    } catch (e: Exception) {
      // Зөвшөөрөл цуцлагдсан, эсвэл дэвсгэрээс эхлүүлэхийг OS хориглосон
      Log.w(TAG, "startForeground failed", e)
      false
    }

  private fun showSteps(steps: Long, force: Boolean) {
    if (steps == shownSteps) return
    val now = System.currentTimeMillis()
    if (!force && now - shownAt < NOTIFY_EVERY_MS) return
    shownSteps = steps
    shownAt = now
    getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, buildNotification(steps))
  }

  private fun ensureChannel() {
    val nm = getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Алхам тоолуур", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Апп хаалттай үед алхам тоолж байгааг харуулна"
        setShowBadge(false)
      }
    )
  }

  private fun buildNotification(steps: Long): Notification {
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(
        this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.alkhaach_steps_notification)
      .setContentTitle("Өнөөдөр ${formatSteps(steps)} алхам")
      .setContentText("АЛХААЧ алхамыг дэвсгэрт тоолж байна")
      .setContentIntent(open)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  /** Мэдрэгчийн timestamp (асаснаас хойшхи нано сек) → ханын цаг (мс). */
  private fun wallClockOf(eventNanos: Long): Long {
    val now = System.currentTimeMillis()
    val ageMs = (SystemClock.elapsedRealtimeNanos() - eventNanos) / 1_000_000
    // Зарим төхөөрөмж өөр цагийн суурь ашигладаг — боломжгүй утга бол одоогийн цагийг авна
    return if (ageMs in 0..DAY_MS) now - ageMs else now
  }

  companion object {
    private const val TAG = "AlkhaachSteps"
    private const val CHANNEL_ID = "alkhaach_steps"
    private const val NOTIFICATION_ID = 7041
    private const val REPORT_LATENCY_US = 10_000_000
    private const val TICK_MS = 15 * 60 * 1000L
    private const val NOTIFY_EVERY_MS = 60_000L
    private const val DAY_MS = 24 * 60 * 60 * 1000L

    fun hasSensor(ctx: Context): Boolean =
      (ctx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager)
        ?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null

    /** Android 10+ дээр ACTIVITY_RECOGNITION; Android 14+ health FGS-д мөн заавал. */
    fun hasPermission(ctx: Context): Boolean =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) ==
        PackageManager.PERMISSION_GRANTED

    /** Асаалттай, мэдрэгч ба зөвшөөрөлтэй бол сервисийг эхлүүлнэ (аль хэдийн ажиллаж байвал хэвээр). */
    fun startIfEnabled(ctx: Context): Boolean {
      if (!StepStore.isEnabled(ctx) || !hasSensor(ctx) || !hasPermission(ctx)) return false
      return try {
        ContextCompat.startForegroundService(ctx, Intent(ctx, StepCounterService::class.java))
        true
      } catch (e: Exception) {
        Log.w(TAG, "could not start step service", e)
        false
      }
    }

    private fun formatSteps(steps: Long): String =
      String.format(Locale.US, "%,d", steps).replace(',', ' ')
  }
}
