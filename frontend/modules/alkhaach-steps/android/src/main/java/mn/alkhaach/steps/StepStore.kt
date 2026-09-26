package mn.alkhaach.steps

import android.content.Context
import android.provider.Settings
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Дэвсгэрийн алхам тоолуурын төлөв: өдөр бүрийн алхам + мэдрэгчийн сүүлийн уншилт.
 *
 * `noBackupFilesDir`-д хадгална. Аппын manifest `allowBackup="true"` тул энгийн
 * SharedPreferences шинэ утас руу сэргээгдэж, өөр төхөөрөмжийн тоолуурын суурь болон
 * сессийн токен backup-д орох байсан.
 *
 * Сервис болон JS модуль нэг процесст ажилладаг тул санах ойн нэг хуулбарыг түгжээтэй
 * хуваалцана. Диск рүү 30 сек тутам бичнэ — процесс гэнэт үхсэн ч алхам алга болохгүй:
 * мэдрэгч асаснаас хойшхи нийлбэрийг өгдөг тул дараагийн уншилт зөрүүг нөхнө.
 */
internal object StepStore {
  private const val FILE_NAME = "alkhaach_steps.json"
  private const val KEEP_DAYS = 30L
  private const val PERSIST_EVERY_MS = 30_000L

  private class State {
    var enabled = false
    var bootCount = -1
    var lastCounter = -1L // -1: суурь хараахан тогтоогоогүй
    val days = mutableMapOf<String, Long>()
    var baseUrl: String? = null
    var token: String? = null
    var lastUpload: String? = null
  }

  class Upload(val url: String, val token: String, val body: String, val key: String)

  private val lock = Any()
  private var cached: State? = null
  private var lastPersistAt = 0L

  fun isEnabled(ctx: Context): Boolean = synchronized(lock) { load(ctx).enabled }

  fun enable(ctx: Context, baseUrl: String?, token: String?) {
    synchronized(lock) {
      val s = load(ctx)
      // Унтраалттай байх үеийн алхамыг өнөөдөрт овоолохгүйн тулд суурийг шинээр авна
      if (!s.enabled) s.lastCounter = -1
      s.enabled = true
      s.baseUrl = baseUrl?.trimEnd('/')?.ifEmpty { null }
      s.token = token
      s.lastUpload = null
      persist(ctx, s)
    }
  }

  fun disable(ctx: Context) {
    synchronized(lock) {
      val s = load(ctx)
      s.enabled = false
      s.lastCounter = -1
      s.baseUrl = null
      s.token = null
      persist(ctx, s)
    }
  }

  /** Унтраалттай үед токен хадгалахгүй (шаардлагагүй газар нууц үлдээхгүй). */
  fun setToken(ctx: Context, token: String?) {
    synchronized(lock) {
      val s = load(ctx)
      if (!s.enabled || s.token == token) return
      s.token = token
      s.lastUpload = null
      persist(ctx, s)
    }
  }

  /** 401 авбал тэр токеныг л хаяна (энэ хооронд шинэ токен ирсэн байж болно). */
  fun dropToken(ctx: Context, token: String) {
    synchronized(lock) {
      val s = load(ctx)
      if (s.token != token) return
      s.token = null
      persist(ctx, s)
    }
  }

  /**
   * Мэдрэгчийн нийлбэр утгыг (утас асаснаас хойшхи алхам) бүртгэж, өнөөдрийн алхамыг буцаана.
   * [eventMs] — алхам болсон ханын цаг: batch-аар хожуу ирсэн ч зөв өдөрт нь бичнэ.
   */
  fun recordCounter(ctx: Context, raw: Long, eventMs: Long): Long {
    synchronized(lock) {
      val s = load(ctx)
      val boot = currentBootCount(ctx)
      val hadBaseline = s.lastCounter >= 0
      val delta = when {
        !hadBaseline -> 0L
        // Утас дахин асчээ — тоолуур 0-ээс эхэлсэн тул одоогийн утга бүхэлдээ шинэ алхам
        boot != -1 && s.bootCount != -1 && boot != s.bootCount -> raw
        raw < s.lastCounter -> raw
        else -> raw - s.lastCounter
      }
      s.lastCounter = raw
      s.bootCount = boot
      if (delta > 0) {
        val day = dateOf(eventMs)
        s.days[day] = (s.days[day] ?: 0L) + delta
        prune(s)
      }
      if (!hadBaseline || System.currentTimeMillis() - lastPersistAt >= PERSIST_EVERY_MS) {
        persist(ctx, s)
      }
      return s.days[today()] ?: 0L
    }
  }

  fun todaySteps(ctx: Context): Long = synchronized(lock) { load(ctx).days[today()] ?: 0L }

  /** Сүүлийн [n] хоногоос алхамтай өдрүүд (хуучнаас шинэ рүү). */
  fun recentDays(ctx: Context, n: Int): List<Pair<String, Long>> {
    synchronized(lock) {
      val s = load(ctx)
      val now = LocalDate.now()
      return (n - 1 downTo 0)
        .map { now.minusDays(it.toLong()).toString() }
        .mapNotNull { d -> s.days[d]?.takeIf { it > 0 }?.let { d to it } }
    }
  }

  /** Серверийн тоо (гараар оруулсан г.м.) илүү бол өдрийн тоог түүнд тэнцүүлнэ — хэзээ ч буурахгүй. */
  fun raiseDay(ctx: Context, date: String, steps: Long) {
    synchronized(lock) {
      val s = load(ctx)
      if (steps <= (s.days[date] ?: 0L)) return
      s.days[date] = steps
      persist(ctx, s)
    }
  }

  /** Өчигдөр + өнөөдрийн тоо сүүлд илгээснээс өөрчлөгдсөн бол илгээх ажил. */
  fun pendingUpload(ctx: Context): Upload? {
    synchronized(lock) {
      val s = load(ctx)
      val url = s.baseUrl ?: return null
      val token = s.token ?: return null
      if (!s.enabled) return null
      val now = LocalDate.now()
      val dates = listOf(now.minusDays(1).toString(), now.toString())
        .filter { (s.days[it] ?: 0L) > 0 }
      if (dates.isEmpty()) return null
      val key = dates.joinToString("|") { "$it:${s.days[it]}" }
      if (key == s.lastUpload) return null
      val days = JSONArray()
      for (d in dates) {
        days.put(JSONObject().put("local_date", d).put("steps", s.days[d]).put("source", "device"))
      }
      return Upload("$url/api/steps/sync", token, JSONObject().put("days", days).toString(), key)
    }
  }

  fun markUploaded(ctx: Context, key: String) {
    synchronized(lock) {
      load(ctx).lastUpload = key
    }
  }

  /** Сервис зогсоход санах ойн төлөвийг диск рүү бичнэ. */
  fun flush(ctx: Context) {
    synchronized(lock) { cached?.let { persist(ctx, it) } }
  }

  // ---------- дотоод ----------

  private fun today(): String = LocalDate.now().toString()

  private fun dateOf(ms: Long): String =
    Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault()).toLocalDate().toString()

  private fun prune(s: State) {
    val cutoff = LocalDate.now().minusDays(KEEP_DAYS).toString()
    s.days.keys.removeAll { it < cutoff } // ISO огноо тул мөрөөр харьцуулж болно
  }

  private fun currentBootCount(ctx: Context): Int =
    try {
      Settings.Global.getInt(ctx.contentResolver, Settings.Global.BOOT_COUNT)
    } catch (_: Exception) {
      -1
    }

  private fun file(ctx: Context) = AtomicFile(File(ctx.noBackupFilesDir, FILE_NAME))

  private fun load(ctx: Context): State {
    cached?.let { return it }
    val s = State()
    try {
      val json = JSONObject(String(file(ctx).readFully(), Charsets.UTF_8))
      s.enabled = json.optBoolean("enabled")
      s.bootCount = json.optInt("bootCount", -1)
      s.lastCounter = json.optLong("lastCounter", -1)
      json.optJSONObject("days")?.let { d ->
        for (k in d.keys()) s.days[k] = d.optLong(k)
      }
      s.baseUrl = json.optStringOrNull("baseUrl")
      s.token = json.optStringOrNull("token")
      s.lastUpload = json.optStringOrNull("lastUpload")
    } catch (_: Exception) {
      // Анх удаа эсвэл файл эвдэрсэн — шинээр эхэлнэ
    }
    cached = s
    return s
  }

  private fun persist(ctx: Context, s: State) {
    val json = JSONObject()
      .put("enabled", s.enabled)
      .put("bootCount", s.bootCount)
      .put("lastCounter", s.lastCounter)
      .put("days", JSONObject(s.days as Map<*, *>))
    s.baseUrl?.let { json.put("baseUrl", it) }
    s.token?.let { json.put("token", it) }
    s.lastUpload?.let { json.put("lastUpload", it) }
    val f = file(ctx)
    val out = try {
      f.startWrite()
    } catch (_: Exception) {
      return
    }
    try {
      out.write(json.toString().toByteArray(Charsets.UTF_8))
      f.finishWrite(out)
      lastPersistAt = System.currentTimeMillis()
    } catch (_: Exception) {
      f.failWrite(out)
    }
  }

  private fun JSONObject.optStringOrNull(key: String): String? =
    if (has(key) && !isNull(key)) getString(key) else null
}
