import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// -------------------- STYLE CHO CHART --------------------
const style = document.createElement('style');
style.textContent = `
  #tempChart {
    width: 100%;
    max-width: 800px;
    height: 400px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    margin-top: 16px;
    padding: 8px;
  }
`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", () => {
  // -------------------- DROPDOWN --------------------
  const btn = document.getElementById("dropdownBtn");
  const list = document.getElementById("dropdownList");

  const options = [
    {label:"1 phút", value:60000}, 
    //{label:"1 phút", value:2000},
    {label:"5 phút", value:300000},
    {label:"10 phút", value:600000},
    {label:"30 phút", value:1800000},
    {label:"1 giờ", value:3600000},
    {label:"2 giờ", value:7200000},
    {label:"5 giờ", value:18000000},
    {label:"10 giờ", value:36000000},
    {label:"1 ngày", value:86400000},
    {label:"2 ngày", value:172800000},
  ];

  let selectedInterval = 60000; // mặc định 1 phút

  function selectIntervalValue(ms) {
    selectedInterval = ms;
    updateChartDisplay();
  }

  options.forEach(opt => {
    const item = document.createElement("div");
    item.className = "cursor-pointer px-4 py-2 hover:bg-blue-100 transition-colors";
    item.textContent = opt.label;
    item.dataset.value = opt.value;

    item.addEventListener("click", () => {
      btn.firstChild.textContent = opt.label;
      list.classList.add("hidden");
      selectIntervalValue(opt.value);
    });

    list.appendChild(item);
  });

  btn.addEventListener("click", () => {
    list.classList.toggle("hidden");
  });


// -------------------- NÚT RESET --------------------
const resetBtn = document.getElementById("resetChartBtn");

resetBtn.addEventListener("click", () => {
  // Xóa dữ liệu cũ
  allLabels.length = 0;
  allTempThucTe.length = 0;
  allTempMongMuon.length = 0;

  // Cập nhật chart rỗng
  tempChart.data.labels = [];
  tempChart.data.datasets[0].data = [];
  tempChart.data.datasets[1].data = [];
  tempChart.update();

  console.log("✅ Chart đã được reset, bắt đầu vẽ lại từ đầu.");
});


  // -------------------- CHART --------------------
  const ctx = document.getElementById("tempChart").getContext("2d");

window.tempChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Nhiệt độ thực tế (°C)",
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.1)",
        data: [],
        tension: 0.3,
      },
      {
        label: "Nhiệt độ mong muốn (°C)",
        borderColor: "rgb(54, 162, 235)",
        backgroundColor: "rgba(54, 162, 235, 0.1)",
        data: [],
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',          // chỉ pan theo trục x
          modifierKey: 'ctrl' // giữ Ctrl để pan
        },
        zoom: {
          wheel: { enabled: true },  // zoom bằng scroll chuột
          pinch: { enabled: true },  // zoom bằng pinch trên touch
          mode: 'x'
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: "Thời gian" },
        ticks: { maxRotation: 45, minRotation: 0 }
      },
      y: {
        title: { display: true, text: "Nhiệt độ (°C)" },
        min: 25,
        max: 45,
      },
    },
  },
  plugins: [ChartZoom], // thêm plugin zoom
});


  // -------------------- DỮ LIỆU --------------------
  const allLabels = [];
  const allTempThucTe = [];
  const allTempMongMuon = [];

  async function updateChartData() {
    try {
      const res = await fetch("https://eggiot-e58fe-default-rtdb.firebaseio.com/DS18B20.json");
      const data = await res.json();

      const tempThucTe = data?.TEMP_THUCTE;
      const tempMongMuon = data?.TEMP_MONGMUON;

      if (tempThucTe !== undefined && tempMongMuon !== undefined) {
        const now = new Date();
        allLabels.push(now);
        allTempThucTe.push(tempThucTe);
        allTempMongMuon.push(tempMongMuon);

        updateChartDisplay();
      }
    } catch (err) {
      console.error("Lỗi khi cập nhật biểu đồ:", err);
    }
  }

  // -------------------- HIỂN THỊ THEO MỐC THỜI GIAN --------------------
  function updateChartDisplay() {
    const displayedLabels = [];
    const displayedTempThucTe = [];
    const displayedTempMongMuon = [];

    let lastTime = 0;

    allLabels.forEach((t, i) => {
      const tMs = t.getTime();
      if (tMs - lastTime >= selectedInterval || lastTime === 0) {
        displayedLabels.push(t.toLocaleTimeString());
        displayedTempThucTe.push(allTempThucTe[i]);
        displayedTempMongMuon.push(allTempMongMuon[i]);
        lastTime = tMs;
      }
    });

    tempChart.data.labels = displayedLabels;
    tempChart.data.datasets[0].data = displayedTempThucTe;
    tempChart.data.datasets[1].data = displayedTempMongMuon;
    tempChart.update();
  }

  // -------------------- AUTO UPDATE MỖI 10 GIÂY --------------------
//setInterval(updateChartData, 10000);********************************************
  setInterval(updateChartData, 2000);
  updateChartData(); // gọi lần đầu
});
