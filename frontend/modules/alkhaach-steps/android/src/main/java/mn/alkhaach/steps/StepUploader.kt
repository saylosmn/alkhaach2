package mn.alkhaach.steps

import android.content.Context
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Апп хаалттай үед ч өнөөдөр/өчигдрийн алхамыг сервер рүү илгээнэ — бүлгийн гишүүд
 * шинэ тоог харж, оройн сануулга алхсан хүнд буруу очихгүй. Амжилтгүй бол дараагийн
 * tick-д дахин оролдоно; апп нээгдэхэд JS синк бүгдийг нөхнө.
 */
internal object StepUploader {
  private const val TAG = "AlkhaachSteps"
  private val inFlight = AtomicBoolean(false)

  fun upload(ctx: Context, executor: ExecutorService) {
    val job = StepStore.pendingUpload(ctx) ?: return
    if (!inFlight.compareAndSet(false, true)) return
    try {
      executor.execute {
        try {
          send(ctx, job)
        } finally {
          inFlight.set(false)
        }
      }
    } catch (_: RejectedExecutionException) {
      inFlight.set(false) // сервис зогсож байна
    }
  }

  private fun send(ctx: Context, job: StepStore.Upload) {
    var conn: HttpURLConnection? = null
    try {
      conn = (URL(job.url).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 60_000 // Render-ийн үнэгүй багц унтсан бол сэрэхэд удна
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer ${job.token}")
      }
      conn.outputStream.use { it.write(job.body.toByteArray(Charsets.UTF_8)) }
      when (conn.responseCode) {
        in 200..299 -> StepStore.markUploaded(ctx, job.key)
        401 -> StepStore.dropToken(ctx, job.token) // сесс дууссан — апп дахин нэвтрэхэд шинэчлэгдэнэ
      }
    } catch (e: Exception) {
      Log.i(TAG, "step upload failed: ${e.message}")
    } finally {
      conn?.disconnect()
    }
  }
}
