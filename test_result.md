#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: >
  Android дээр алхам огт тоологдохгүй байсан. Түүнийг зассаны дараа кодыг бүтнээр
  шалгаж, гаргахад саад болох алдаа, тестийн ажиллах чадвар, backend-ийн
  тогтвортой байдлыг цэгцлэв.

backend:
  - task: "POST /api/register-push нэвтрэлт шаардах"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    status_history:
      - working: "NA"
        agent: "main"
        comment: >
          Өмнө нь Depends(get_current_user) байхгүй, body.user_id-д итгэдэг байсан —
          хэн ч бусдын нэрээр push токен бүртгэх боломжтой байв. Одоо user_id-г зөвхөн
          session-ээс авна, RegisterPushBody-оос талбарыг хассан. ASGI дуудлагаар
          токенгүй хүсэлт 401 буцаж байгааг локал баталсан. Жинхэнэ backend дээр
          iter2_test.py::TestPush дахин ажиллуулах шаардлагатай.

  - task: "lifespan руу шилжүүлэх + мэдэгдлийн scheduler-ийг гаднаас дуудах"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    status_history:
      - working: "NA"
        agent: "main"
        comment: >
          @app.on_event (deprecated) → asynccontextmanager lifespan. Шинэ
          POST /api/internal/notify-tick (X-Notify-Secret толгойгоор хамгаалсан) нэмсэн:
          Render free tier унтдаг тул гадны cron 5 мин тутам дуудна. SCHEDULER_IN_PROCESS=0
          үед дотоод давталт унтарна. NOTIFY_SECRET тохируулаагүй бол эндпойнт 404.
          Локал ASGI шалгалт: secret байхгүй→404, буруу secret→401. notification_tick
          хэрэглэгчдийг to_list(10000)-ийн оронд курсороор боловсруулна.

  - task: "CORS: allow_credentials=False"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    status_history:
      - working: "NA"
        agent: "main"
        comment: "allow_origins=['*'] нь allow_credentials=True-тэй хамт хүчингүй. Токен header-ээр явдаг тул credentials хэрэггүй."

  - task: "Тест цэвэр орчинд ажиллах"
    implemented: true
    working: "NA"
    file: "backend/tests/conftest.py"
    status_history:
      - working: "NA"
        agent: "main"
        comment: >
          Тестүүд репод байхгүй memory/test_credentials.md-ийн seed токеноос хамаардаг
          байсан. Одоо conftest.py хоёр хэрэглэгч/session-ийг Mongo руу өөрөө бичнэ
          (idempotent upsert), join_fails-ийг цэвэрлэнэ. xdist-ийн 2 worker хоорондоо
          зөрчилдөхөөс сэргийлж teardown дээр устгал хийхгүй. requirements-dev.txt
          нэмсэн (pytest, pytest-xdist, requests).

frontend:
  - task: "Android дээр алхам тоолох"
    implemented: true
    working: "NA"
    file: "frontend/src/steps.ts"
    status_history:
      - working: "NA"
        agent: "main"
        comment: >
          readDeviceDays нь Android-д шууд null буцаадаг байсан → огт тоолохгүй.
          Pedometer.watchStepCount-оор өдрийн хуримтлал (alkhaach_live_steps).
          Өдөр солигдоход өмнөх өдрийн тоо офлайн дараалалд шилжинэ (өмнө нь алдагддаг байв).
          Серверийн тоо илүү бол локалыг түүнд тэнцүүлнэ (reconcileLive) — тоо буурахгүй.
          Health Connect зөвшөөрөгдсөн бол мэдрэгчийг асаахгүй (давхар тооллого).
          Апп дэвсгэрт ороход subscription салж, идэвхжихэд дахин холбогдоно.
          ⚠️ Бодит Android төхөөрөмж дээр батлах шаардлагатай.

  - task: "eas.json production URL эвдэрсэн"
    implemented: true
    working: "NA"
    file: "frontend/eas.json"
    status_history:
      - working: "NA"
        agent: "main"
        comment: >
          production дээрх URL ард нь налуу зураастай байсан тул api.ts нь …com//api
          гэж залгаж, production build бүх хүсэлт нь эвдэрдэг байв (preview ажилладаг).
          Зураас хассан + api.ts дээр .replace(/\/+$/,"") хамгаалалт нэмсэн.
          Бүх баримт бичгийг alkhaach2.onrender.com руу нэгтгэсэн.

  - task: "Хуучирсан давхардсан route файлууд"
    implemented: true
    working: "NA"
    file: "frontend/app/tabs-home.tsx, frontend/app/tabs-groups.tsx"
    status_history:
      - working: "NA"
        agent: "main"
        comment: "expo-router эдгээрийг /tabs-home, /tabs-groups болгон бүртгэж, хуучин UI үзүүлж байсан. Устгасан (код дотор холбоос байхгүй)."

metadata:
  created_by: "main_agent"
  version: "1.1"
  run_ui: false

test_plan:
  current_focus:
    - "POST /api/register-push нэвтрэлт шаардах"
    - "Тест цэвэр орчинд ажиллах"
    - "Android дээр алхам тоолох"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      Backend-ийн өөрчлөлтийг зөвхөн локал ASGI дуудлага + import-оор шалгасан
      (энэ орчинд Mongo, Node.js байхгүй). Дараагийн алхам: жинхэнэ backend
      асаагаад pytest tests ажиллуулах, дараа нь Android дээр preview APK-аар
      алхам тоолохыг батлах.
