// ====================== Import Firebase SDK ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ====================== Cấu hình Firebase ======================
const firebaseConfig = {
  apiKey: "AIzaSyC0iUHNh5c6cyTHKLntLg3A3K6xJDM-Ycc",
  authDomain: "eggiot-e58fe.firebaseapp.com",
  databaseURL: "https://eggiot-e58fe-default-rtdb.firebaseio.com",
  projectId: "eggiot-e58fe",
  storageBucket: "eggiot-e58fe.appspot.com",
  messagingSenderId: "289720604766",
  appId: "1:289720604766:web:15d614d254cc01e30bbccf",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ====================== Hàm format thời gian ======================
function pad(n) { return n < 10 ? "0" + n : n; }
function formatDateTime(obj) {
  if (!obj) return "--";
  return `${pad(obj.day)}/${pad(obj.month)}/${obj.year} ${pad(obj.hour)}:${pad(obj.minute)}:${pad(obj.second)}`;
}

// ====================== Get elements ======================
function getEl(id) { return document.getElementById(id) || null; }

const elCurrentStage = getEl("current-stage");
const elSystemStatus = getEl("system-status");
const elTargetTemp = getEl("target-temp");
const elTempValue = getEl("temp-value");
const elRelayState = getEl("relay-state");
const elSetupTime = getEl("setup-time");
const elCurrentTime = getEl("current-time");

const toggleBtn = getEl("toggle-setup-btn");
const setupContent = getEl("setup-content");

// ====================== Toggle slide setup ======================
if (toggleBtn && setupContent) {
  toggleBtn.addEventListener("click", () => {
    if (setupContent.style.maxHeight) {
      setupContent.style.maxHeight = null;
    } else {
      setupContent.style.maxHeight = setupContent.scrollHeight + "px";
    }
  });
}

// ====================== Cập nhật thời gian thực ======================
const timeRef = ref(db, "SETUP/currentTime");
function pushCurrentTime() {
  const now = new Date();
  const timeData = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  };
  set(timeRef, timeData).catch((error) => console.error("Lỗi cập nhật thời gian:", error));

  if (elCurrentTime) {
    elCurrentTime.innerText = `${pad(timeData.day)}/${pad(timeData.month)}/${timeData.year} ${pad(timeData.hour)}:${pad(timeData.minute)}:${pad(timeData.second)}`;
  }
}
setInterval(pushCurrentTime, 1000);

// ====================== Hiển thị trạng thái hiện tại ======================
const rootRef = ref(db, "/");
onValue(rootRef, (snap) => {
  const data = snap.val();
  if (!data) return;

  // --- DS18B20 ---
  const ds = data.DS18B20 || {};
  if (elCurrentStage) elCurrentStage.textContent = (ds.CURRENT_STAGE != null) ? (ds.CURRENT_STAGE + 1) : "--";
  if (elSystemStatus) elSystemStatus.textContent = ds.STATUS ?? "--";
  if (elTargetTemp) elTargetTemp.textContent = (ds.TEMP_MONGMUON != null) ? `${ds.TEMP_MONGMUON} °C` : "--";
  if (elTempValue) elTempValue.textContent = (ds.TEMP_THUCTE != null) ? `${parseFloat(ds.TEMP_THUCTE).toFixed(2)} °C` : "--";

  // --- Relay ---
  const lamp = data.LAMP || {};
  if (elRelayState) elRelayState.textContent = (lamp.RELAY_STATE == 1) ? "BẬT" : "TẮT";

  // --- Thời gian setup ---
  const setup = data.SETUP || {};
  if (elSetupTime) elSetupTime.textContent = setup.STAGE_START_TIME ? formatDateTime(setup.STAGE_START_TIME) : "--";
  const elStageEndTime = getEl("stage-end-time");
  if (elStageEndTime) elStageEndTime.textContent = setup.STAGE_END_TIME ? formatDateTime(setup.STAGE_END_TIME) : "--";
});

// ====================== Hiển thị slide setup stages ======================
const stagesRef = ref(db, "SETUP/STAGES");
onValue(stagesRef, (snapshot) => {
  const stages = snapshot.val();
  if (!setupContent) return;

  if (!stages || !Array.isArray(stages)) {
    setupContent.innerHTML = "<i>Chưa có thiết lập stage nào.</i>";
    return;
  }

  setupContent.innerHTML = ""; // reset

  stages.forEach((stage, i) => {
    const temp = stage.temp ?? "--";
    const totalMinutes = stage.time ?? 0;
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    const div = document.createElement("div");
    div.className = "setup-item";
    div.textContent = `Giai đoạn ${i + 1}: ${temp}°C – ${days} ngày ${hours} giờ ${minutes} phút`;

    setupContent.appendChild(div);
  });
});
