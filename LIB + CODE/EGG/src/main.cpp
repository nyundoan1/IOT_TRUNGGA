/*
  =======================================================
  Esp32 Firebase DS18B20 Stage Controller - CurrentTime Based
  -------------------------------------------------------
  - Sử dụng currentTime từ Firebase để tính stageEndTime
  - Relay tự động bật/tắt theo temp ±HYSTERESIS
  - Chuyển stage tự động khi hết thời gian
  =======================================================
*/

#include <WiFi.h>
#include <FirebaseESP32.h>
#include <OneWire.h>
#include <DallasTemperature.h>

//======================================================//
//===================== CONFIG ========================//
//======================================================//
#define WIFI_SSID       "Yen Nhi"
#define WIFI_PASSWORD   "Nhi19112009"

#define FIREBASE_HOST   "eggiot-e58fe-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH   "AIzaSyC0iUHNh5c6cyTHKLntLg3A3K6xJDM-Ycc"

#define ONE_WIRE_BUS 32          // Chân DS18B20
#define RELAY_PIN  33            // Chân relay
#define RELAY_ACTIVE_LOW true    // Nếu module relay active LOW -> true, ngược lại false

const float HYSTERESIS = 0.5f;   // ± sai số nhiệt độ
const unsigned long LOOP_INTERVAL = 500UL; // 0.5s

//======================================================//
//================= OBJECTS / VAR =====================//
//======================================================//
FirebaseData fbdo;
FirebaseConfig config;
FirebaseAuth auth;

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

int currentStage = 0;
bool stageRunning = false;
float lastTempMongMuon = -1000.0;
int lastTimeMongMuon = -1;

int relayState = 0;

struct TimeStruct {
  int year, month, day, hour, minute, second;
};

TimeStruct stageEndTime;
unsigned long lastLoopMillis = 0;

//======================================================//
//===================== HELPERS =======================//
//======================================================//

/*
  =======================================================
  Hàm: applyRelayState
  Mô tả:
    - Bật/Tắt relay vật lý
    - Đồng bộ trạng thái relay lên Firebase
  Tham số:
    state: 0 = tắt, 1 = bật
*/
void applyRelayState(int state) {
  relayState = (state ? 1 : 0);
  if (RELAY_ACTIVE_LOW) digitalWrite(RELAY_PIN, relayState ? LOW : HIGH);
  else digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);

  if (!Firebase.setInt(fbdo, "/LAMP/RELAY_STATE", relayState)) {
    Serial.println("!ERR: Firebase.setInt /LAMP/RELAY_STATE failed: " + fbdo.errorReason());
  }
  Serial.printf("🔌 Relay -> %s (physical: %s)\n",
                relayState ? "BẬT" : "TẮT",
                (RELAY_ACTIVE_LOW ? (relayState ? "LOW" : "HIGH") : (relayState ? "HIGH" : "LOW")));
}

/*
  =======================================================
  Hàm: getStage
  Mô tả:
    - Lấy nhiệt độ mục tiêu và thời gian stage từ Firebase
  Tham số:
    idx: chỉ số stage
    outTemp: nhiệt độ mục tiêu trả ra
    outTime: thời gian stage trả ra (phút)
  Trả về:
    true nếu đọc thành công, false nếu lỗi
*/
bool getStage(int idx, float &outTemp, int &outTime) {
  String base = "/SETUP/STAGES/" + String(idx);
  if (!Firebase.getFloat(fbdo, base + "/temp")) return false;
  outTemp = fbdo.floatData();
  if (!Firebase.getInt(fbdo, base + "/time")) return false;
  outTime = fbdo.intData();
  return true;
}

/*
  =======================================================
  Hàm: getCurrentTime
  Mô tả:
    - Lấy currentTime từ Firebase
  Tham số:
    t: cấu trúc TimeStruct nhận thời gian hiện tại
  Trả về:
    true nếu đọc thành công, false nếu lỗi
*/
bool getCurrentTime(TimeStruct &t) {
  if (!Firebase.getInt(fbdo, "/SETUP/currentTime/year")) return false;
  t.year = fbdo.intData();
  if (!Firebase.getInt(fbdo, "/SETUP/currentTime/month")) return false;
  t.month = fbdo.intData();
  if (!Firebase.getInt(fbdo, "/SETUP/currentTime/day")) return false;
  t.day = fbdo.intData();
  if (!Firebase.getInt(fbdo, "/SETUP/currentTime/hour")) return false;
  t.hour = fbdo.intData();
  if (!Firebase.getInt(fbdo, "/SETUP/currentTime/minute")) return false;
  t.minute = fbdo.intData();
  if (!Firebase.getInt(fbdo, "/SETUP/currentTime/second")) return false;
  t.second = fbdo.intData();
  return true;
}

/*
  =======================================================
  Hàm: addSeconds
  Mô tả:
    - Cộng delta giây vào TimeStruct
  Tham số:
    t1: thời gian gốc
    deltaSeconds: số giây cần cộng
  Trả về:
    TimeStruct mới
*/
TimeStruct addSeconds(const TimeStruct &t1, unsigned long deltaSeconds) {
  TimeStruct t2 = t1;
  unsigned long totalSec = t1.second + deltaSeconds;
  t2.second = totalSec % 60; totalSec /= 60;
  unsigned long totalMin = t1.minute + totalSec;
  t2.minute = totalMin % 60; totalMin /= 60;
  unsigned long totalHour = t1.hour + totalMin;
  t2.hour = totalHour % 24; totalHour /= 24;
  unsigned long totalDays = t1.day + totalHour;
  t2.day = totalDays;
  return t2;
}

/*
  =======================================================
  Hàm: isTimeReached
  Mô tả:
    - So sánh current >= target
  Tham số:
    current: thời gian hiện tại
    target: thời gian mục tiêu
  Trả về:
    true nếu current >= target, false nếu ngược lại
*/
bool isTimeReached(const TimeStruct &current, const TimeStruct &target) {
  if (current.year > target.year) return true;
  if (current.year < target.year) return false;
  if (current.month > target.month) return true;
  if (current.month < target.month) return false;
  if (current.day > target.day) return true;
  if (current.day < target.day) return false;
  if (current.hour > target.hour) return true;
  if (current.hour < target.hour) return false;
  if (current.minute > target.minute) return true;
  if (current.minute < target.minute) return false;
  if (current.second >= target.second) return true;
  return false;
}

/*
  =======================================================
  Hàm: resetToStage0
  Mô tả:
    - Reset stage về 0
    - Cập nhật relay, trạng thái và Firebase
*/
void resetToStage0() {
  float t0; int time0;
  if (!getStage(0, t0, time0)) {
    Serial.println("!WARN: cannot read stage 0");
    currentStage = -1; stageRunning = false;
    applyRelayState(0);
    Firebase.setString(fbdo, "/DS18B20/STATUS", "no");
    return;
  }
  currentStage = 0; stageRunning = false;
  lastTempMongMuon = t0; lastTimeMongMuon = time0;
  applyRelayState(0);
  Firebase.setInt(fbdo, "/DS18B20/CURRENT_STAGE", currentStage);
  Firebase.setString(fbdo, "/DS18B20/STATUS", "pending");
  Firebase.setFloat(fbdo, "/DS18B20/TEMP_MONGMUON", lastTempMongMuon);
  Serial.println("🔄 Reset to stage0");
}

/*
  =======================================================
  SETUP
  Mô tả:
    - Khởi tạo Serial, Relay, DS18B20, WiFi, Firebase
    - Reset stage về 0
*/
void setup() {
  Serial.begin(115200); delay(500);
  pinMode(RELAY_PIN, OUTPUT);
  applyRelayState(0);
  sensors.begin();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("🔌 Connecting WiFi");
  unsigned long startWiFi = millis();
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print("."); delay(300);
    if (millis() - startWiFi > 15000UL) startWiFi = millis();
  }
  Serial.println(" ✅ IP: " + WiFi.localIP().toString());

  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("🔗 Firebase ready");

  resetToStage0();
}

/*
  =======================================================
  LOOP
  Mô tả:
    - Đọc nhiệt độ DS18B20
    - Kiểm tra stage & điều khiển relay
    - Cập nhật Firebase
*/
void loop() {
  if (millis() - lastLoopMillis < LOOP_INTERVAL) return;
  lastLoopMillis = millis();

  if (!Firebase.ready()) return;

  // --- Đọc nhiệt độ thực tế ---
  sensors.requestTemperatures();
  float tempThucTe = sensors.getTempCByIndex(0);
  if (tempThucTe == DEVICE_DISCONNECTED_C) { 
    applyRelayState(0); 
    return; 
  }

  if (tempThucTe >= 0.0 && tempThucTe <= 60.0) {
    Firebase.setFloat(fbdo, "/DS18B20/TEMP_THUCTE", tempThucTe);
  }

  Serial.printf("Temp: %.2f\n", tempThucTe);

  // --- Kiểm tra config thay đổi (dựa vào STAGES) ---
  static bool firstCheck = true;
  static std::vector<float> lastTempConfig;
  static std::vector<int> lastTimeConfig;

  int totalStages = 0;
  // Đếm số stage hiện tại
  for (int i = 0;; i++) {
    float t; int tm;
    if (!getStage(i, t, tm)) break;
    totalStages++;
  }

  // Khởi tạo lần đầu
  if (firstCheck) {
    lastTempConfig.resize(totalStages);
    lastTimeConfig.resize(totalStages);
    for (int i = 0; i < totalStages; i++) {
      float t; int tm;
      if (getStage(i, t, tm)) { lastTempConfig[i] = t; lastTimeConfig[i] = tm; }
    }
    firstCheck = false;
  } else {
    // So sánh config hiện tại với lần trước
    for (int i = 0; i < totalStages; i++) {
      float t; int tm;
      if (!getStage(i, t, tm)) continue;
      if (t != lastTempConfig[i] || tm != lastTimeConfig[i]) {
        Serial.println("⚠️ Config changed! Resetting to stage 0...");
        resetToStage0();
        // Cập nhật lại lastConfig
        for (int j = 0; j < totalStages; j++) {
          float tt; int tmj;
          if (getStage(j, tt, tmj)) { lastTempConfig[j] = tt; lastTimeConfig[j] = tmj; }
        }
        return; // chờ loop tiếp theo
      }
    }
  }

  // --- Lấy stage hiện tại ---
  float tempMongMuon = 0.0; 
  int timeMongMuon = 0;
  if (!getStage(currentStage, tempMongMuon, timeMongMuon)) return;

  // --- Lấy currentTime ---
  TimeStruct now;
  if (!getCurrentTime(now)) return;

  // --- Pending -> check temp ±HYSTERESIS để start stage ---
  if (!stageRunning) {
    if (fabs(tempThucTe - tempMongMuon) <= HYSTERESIS) {
      stageRunning = true;
      stageEndTime = addSeconds(now, (unsigned long)timeMongMuon * 60UL);

      // Ghi stageEndTime lên Firebase
      Firebase.setInt(fbdo, "/SETUP/STAGE_END_TIME/year", stageEndTime.year);
      Firebase.setInt(fbdo, "/SETUP/STAGE_END_TIME/month", stageEndTime.month);
      Firebase.setInt(fbdo, "/SETUP/STAGE_END_TIME/day", stageEndTime.day);
      Firebase.setInt(fbdo, "/SETUP/STAGE_END_TIME/hour", stageEndTime.hour);
      Firebase.setInt(fbdo, "/SETUP/STAGE_END_TIME/minute", stageEndTime.minute);
      Firebase.setInt(fbdo, "/SETUP/STAGE_END_TIME/second", stageEndTime.second);

      Firebase.setString(fbdo, "/DS18B20/STATUS", "running");

      Serial.printf("⏳ Stage %d STARTED, ends at %02d:%02d:%02d\n",
                    currentStage, stageEndTime.hour, stageEndTime.minute, stageEndTime.second);
    } else {
      Firebase.setString(fbdo, "/DS18B20/STATUS", "pending");
      Serial.printf("… pending, waiting temp %.2f, current %.2f\n", tempMongMuon, tempThucTe);

      // Relay control theo hysteresis
      if (tempThucTe <= tempMongMuon - HYSTERESIS) applyRelayState(1);
      else if (tempThucTe >= tempMongMuon + HYSTERESIS) applyRelayState(0);
      return;
    }
  }

  // --- Stage running -> kiểm tra endTime ---
  if (stageRunning) {
    // Relay control theo temp
    if (tempThucTe <= tempMongMuon - HYSTERESIS) applyRelayState(1);
    else if (tempThucTe >= tempMongMuon + HYSTERESIS) applyRelayState(0);

    // Kiểm tra nếu đã đến endTime
    if (isTimeReached(now, stageEndTime)) {
      Serial.printf("✅ Stage %d COMPLETED\n", currentStage);
      applyRelayState(0);

      // Chuyển stage tiếp theo
      int nextStage = currentStage + 1;
      float nextTemp; 
      int nextTime;
      if (getStage(nextStage, nextTemp, nextTime)) {
        currentStage = nextStage;
        stageRunning = false;
        lastTempMongMuon = nextTemp;
        lastTimeMongMuon = nextTime;

        Firebase.setInt(fbdo, "/DS18B20/CURRENT_STAGE", currentStage);
        Firebase.setFloat(fbdo, "/DS18B20/TEMP_MONGMUON", lastTempMongMuon);
        Firebase.setString(fbdo, "/DS18B20/STATUS", "pending");

        Serial.println("➡️ Move to next stage " + String(currentStage));
      } else {
        currentStage = -1;
        stageRunning = false;

        Firebase.setString(fbdo, "/DS18B20/CURRENT_STAGE", "no");
        Firebase.setString(fbdo, "/DS18B20/STATUS", "done");

        Serial.println("🏁 All stages completed");

        delay(2000);
        resetToStage0();
      }
    }
  }
}
