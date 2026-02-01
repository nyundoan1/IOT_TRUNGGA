import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyC0iUHNh5c6cyTHKLntLg3A3K6xJDM-Ycc",
  authDomain: "eggiot-e58fe.firebaseapp.com",
  databaseURL: "https://eggiot-e58fe-default-rtdb.firebaseio.com",
  projectId: "eggiot-e58fe",
  storageBucket: "eggiot-e58fe.appspot.com",
  messagingSenderId: "289720604766",
  appId: "1:289720604766:web:15d614d254cc01e30bbccf",
};

// 🔥 Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===================== DOM =====================
const stageForm = document.getElementById("stage-form");
const numStagesInput = document.getElementById("numStages");
const setStagesBtn = document.getElementById("setStagesBtn");
const setupStatus = document.getElementById("setup-status");

// ===================== DYNAMIC STAGE FORM =====================
setStagesBtn.addEventListener("click", () => {
  const numStages = parseInt(numStagesInput.value) || 1;
  stageForm.innerHTML = ""; // Xóa các stage cũ

  for (let i = 1; i <= numStages; i++) {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";

    div.innerHTML = `
      <strong>Giai đoạn ${i}:</strong>
      <input type="number" id="temp${i}" placeholder="Nhiệt độ (°C)" required title="Nhiệt độ cần giữ">
      <input type="number" id="day${i}" placeholder="Ngày" min="0" value="0" required title="Số ngày">
      <input type="number" id="hour${i}" placeholder="Giờ" min="0" max="23" value="0" required title="Số giờ">
      <input type="number" id="minute${i}" placeholder="Phút" min="0" max="59" value="0" required title="Số phút">
    `;

    stageForm.appendChild(div);
  }

  // Thêm nút submit ở cuối
  const btn = document.createElement("button");
  btn.type = "submit";
  btn.className = "set-temp-btn";
  btn.style.marginTop = "16px";
  btn.textContent = "Lưu thiết lập";
  stageForm.appendChild(btn);
});

// ===================== LƯU THIẾT LẬP =====================
stageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const numStages = parseInt(numStagesInput.value) || 1;
  const stages = [];

  for (let i = 1; i <= numStages; i++) {
    const temp = parseFloat(document.getElementById(`temp${i}`).value);
    const time = (parseInt(document.getElementById(`day${i}`).value || 0) * 24 * 60) +
                 (parseInt(document.getElementById(`hour${i}`).value || 0) * 60) +
                 parseInt(document.getElementById(`minute${i}`).value || 0);
    stages.push({ temp, time });
  }

  const now = new Date();
  const setupTime = {
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds()
  };

  try {
    await set(ref(db, "SETUP/STAGES"), stages);
    await set(ref(db, "SETUP/STAGE_START_TIME"), setupTime);
    await set(ref(db, "DS18B20/TEMP_MONGMUON"), stages[0].temp);

    setupStatus.textContent = "✅ Đã lưu thiết lập và thời gian bắt đầu stage!";
    console.log("Đã lưu:", { stages, setupTime });
    window.stageStartTimestamp = Date.now(); // reset timestamp stage
  } catch (err) {
    console.error("Lỗi khi lưu:", err);
    setupStatus.textContent = "❌ Lỗi khi lưu thiết lập!";
  }
});

// ===================== THEO DÕI STAGE HIỆN TẠI =====================
function updateCurrentStatus() {
  const stagesRef = ref(db, "SETUP/STAGES");
  onValue(stagesRef, (snapshot) => {
    const stages = snapshot.val();
    if (!stages || !Array.isArray(stages)) return;

    if (!window.stageStartTimestamp) window.stageStartTimestamp = Date.now();

    const now = Date.now();
    let elapsedSec = Math.floor((now - window.stageStartTimestamp) / 1000);
    let sumTimeSec = 0;
    let currentStageIdx = 0;
    let stageTemp = "--";
    let remainingSec = 0;

    for (let i = 0; i < stages.length; i++) {
      sumTimeSec += stages[i].time * 60;
      if (elapsedSec < sumTimeSec) {
        currentStageIdx = i + 1;
        stageTemp = stages[i].temp;
        remainingSec = sumTimeSec - elapsedSec;
        break;
      }
    }

    // Cập nhật giao diện
    const stageEl = document.getElementById("current-stage");
    const tempEl = document.getElementById("target-temp");
    const timeEl = document.getElementById("stage-end-time");

    if (stageEl) stageEl.textContent = currentStageIdx;
    if (tempEl) tempEl.textContent = stageTemp + " °C";

    const days = Math.floor(remainingSec / (24 * 3600));
    const hours = Math.floor((remainingSec % (24 * 3600)) / 3600);
    const minutes = Math.floor((remainingSec % 3600) / 60);
    const seconds = remainingSec % 60;

    if (timeEl) timeEl.textContent = `${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây`;
  });
}

updateCurrentStatus();
