// ================= LOG.JS ====================

// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC0iUHNh5c6cyTHKLntLg3A3K6xJDM-Ycc",
  authDomain: "eggiot-e58fe.firebaseapp.com",
  databaseURL: "https://eggiot-e58fe-default-rtdb.firebaseio.com",
  projectId: "eggiot-e58fe",
  storageBucket: "eggiot-e58fe.appspot.com",
  messagingSenderId: "289720604766",
  appId: "1:289720604766:web:15d614d254cc01e30bbccf",
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==================== LOGIC ====================

let logs = [];
let currentStage = "--";
let tempThucTe = "--";
let tempMongMuon = "--";

const logContainer = document.getElementById("logDisplay");

// Lấy dữ liệu realtime từ Firebase
const stageRef = ref(db, "DS18B20/CURRENT_STAGE");
const tempThucTeRef = ref(db, "DS18B20/TEMP_THUCTE");
const tempMongMuonRef = ref(db, "DS18B20/TEMP_MONGMUON");

// Theo dõi realtime
onValue(stageRef, (s) => currentStage = s.val() ?? "--");
onValue(tempThucTeRef, (s) => {
  const val = s.val();
  tempThucTe = (typeof val === "number") ? val.toFixed(2) : "--";
});
onValue(tempMongMuonRef, (s) => {
  const val = s.val();
  tempMongMuon = (typeof val === "number") ? val.toFixed(2) : "--";
});

// ==================== GHI LOG MỖI 30 GIÂY ====================
setInterval(() => {
  const now = new Date().toLocaleTimeString("vi-VN", { hour12: false });
  const log = {
    time: now,
    stage: (typeof currentStage === "number") ? currentStage + 1 : currentStage,
    tempThucTe,
    tempMongMuon
  };

  logs.push(log);
  if (logs.length > 300) logs.shift(); // chỉ giữ 300 bản ghi gần nhất
  renderLogs();
}, 30000);

// ==================== HIỂN THỊ LOG ====================
function renderLogs() {
  logContainer.innerHTML = "";

  logs.slice().reverse().forEach((log) => {
    const item = document.createElement("div");
    item.className = "log-item collapsed";
    item.style = `
      background:#fff; border:1px solid #ddd; border-radius:8px;
      margin:6px 0; box-shadow:0 2px 4px rgba(0,0,0,0.05);
    `;

    item.innerHTML = `
      <div class="log-header" style="padding:8px 10px; display:flex; justify-content:space-between; cursor:pointer; background:#f7f7f7;">
        <span> [${log.time}] Giai đoạn: ${log.stage} | ${log.tempThucTe}°C / ${log.tempMongMuon}°C</span>
        <span class="arrow">▶</span>
      </div>
      <div class="log-content" style="padding:10px; border-left:3px solid #2196f3; display:none;">
        <p><b>Thời gian ghi:</b> ${log.time}</p>
        <p><b>Giai đoạn:</b> ${log.stage}</p>
        <p><b>Nhiệt độ thực tế:</b> ${log.tempThucTe} °C</p>
        <p><b>Nhiệt độ mong muốn:</b> ${log.tempMongMuon} °C</p>
      </div>
    `;

    const header = item.querySelector(".log-header");
    const content = item.querySelector(".log-content");
    const arrow = item.querySelector(".arrow");

    header.addEventListener("click", () => {
      const isExpanded = content.style.display === "block";
      content.style.display = isExpanded ? "none" : "block";
      arrow.style.transform = isExpanded ? "rotate(0deg)" : "rotate(90deg)";
    });

    logContainer.appendChild(item);
  });
}
