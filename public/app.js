// // =====================================================
// // WEBGIS QUẢN LÝ CÁC ĐIỂM NGẬP LỤT TẠI HÀ NỘI
// // =====================================================

// // =====================================================
// // 1. KHỞI TẠO BẢN ĐỒ
// // =====================================================

// const map = L.map("map").setView([21.0285, 105.8542], 12);

// L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
//   attribution: "&copy; OpenStreetMap contributors",
// }).addTo(map);

// // =====================================================
// // 2. LAYER ĐIỂM NGẬP
// // =====================================================

// const floodLayer = L.layerGroup().addTo(map);

// // =====================================================
// // 3. ICON ĐIỂM NGẬP
// // =====================================================

// const floodIcon = L.divIcon({
//   className: "",

//   html: `
//     <div class="flood-map-marker">
//       !
//     </div>
//   `,

//   iconSize: [32, 32],

//   iconAnchor: [16, 16],

//   popupAnchor: [0, -16],
// });

// // =====================================================
// // 4. BIẾN DỮ LIỆU
// // =====================================================

// let floodPoints = [];

// // =====================================================
// // 5. LẤY DỮ LIỆU OPEN-METEO
// // =====================================================

// async function getOpenMeteoRain(lat, lng) {
//   try {
//     const url =
//       `https://api.open-meteo.com/v1/forecast` +
//       `?latitude=${lat}` +
//       `&longitude=${lng}` +
//       `&current=precipitation,rain` +
//       `&timezone=Asia%2FHo_Chi_Minh`;

//     const response = await fetch(url);

//     if (!response.ok) {
//       throw new Error(`Open-Meteo HTTP ${response.status}`);
//     }

//     const data = await response.json();

//     return {
//       precipitation: data.current?.precipitation ?? null,

//       rain: data.current?.rain ?? null,

//       time: data.current?.time ?? null,

//       // Tọa độ grid mà Open-Meteo thực sự trả về
//       meteo_latitude: data.latitude ?? null,

//       meteo_longitude: data.longitude ?? null,
//     };
//   } catch (error) {
//     console.error("Lỗi Open-Meteo:", error);

//     return {
//       precipitation: null,
//       rain: null,
//       time: null,

//       meteo_latitude: null,
//       meteo_longitude: null,
//     };
//   }
// }

// // =====================================================
// // 6. TẠO MARKER ĐIỂM NGẬP
// // =====================================================

// async function addFloodMarker(point) {
//   const lat = Number(point.Lat);

//   const lng = Number(point.Lng);

//   // -----------------------------------------
//   // Lấy thời tiết tại vị trí điểm
//   // -----------------------------------------

//   const rainData = await getOpenMeteoRain(lat, lng);

//   // -----------------------------------------
//   // Hiển thị dữ liệu
//   // -----------------------------------------

//   const rain =
//     rainData.rain !== null ? `${rainData.rain} mm` : "Không có dữ liệu";

//   const precipitation =
//     rainData.precipitation !== null
//       ? `${rainData.precipitation} mm`
//       : "Không có dữ liệu";

//   const time = rainData.time ?? "Không có dữ liệu";

//   // -----------------------------------------
//   // Marker
//   // -----------------------------------------

//   const marker = L.marker([lat, lng], {
//     icon: floodIcon,
//   });

//   // -----------------------------------------
//   // Popup
//   // -----------------------------------------

//   marker.bindPopup(`
//     <div class="popup">

//       <h3>
//         ${point.TenTram || "Điểm ngập"}
//       </h3>

//       <p>
//         <b>Mã điểm HSDC:</b>
//         ${point.TramId ?? "Không có"}
//       </p>

//       <p>
//         <b>Vĩ độ:</b>
//         ${lat}
//       </p>

//       <p>
//         <b>Kinh độ:</b>
//         ${lng}
//       </p>

//       <hr>

//       <p>
//         <b>🌧️ Dữ liệu Open-Meteo</b>
//       </p>

//       <p>
//         Lượng mưa:
//         <b>${rain}</b>
//       </p>

//       <p>
//         Lượng giáng thủy:
//         <b>${precipitation}</b>
//       </p>

//       <p>
//         Thời gian:
//         ${time}
//       </p>

//       ${
//         rainData.meteo_latitude !== null
//           ? `
//             <p class="weather-grid">
//               Grid thời tiết:
//               ${rainData.meteo_latitude},
//               ${rainData.meteo_longitude}
//             </p>
//           `
//           : ""
//       }

//       <hr>

//       <p style="
//         color:#dc2626;
//         font-weight:bold;
//       ">
//         ⚠ Điểm ngập HSDC
//       </p>

//     </div>
//   `);

//   // -----------------------------------------
//   // Add vào đúng layer
//   // -----------------------------------------

//   floodLayer.addLayer(marker);
// }

// // =====================================================
// // 7. LẤY DỮ LIỆU ĐIỂM NGẬP HSDC
// // =====================================================

// async function loadFloodData() {
//   try {
//     const statusElement = document.getElementById("status");

//     statusElement.textContent = "Đang tải...";

//     statusElement.style.color = "#d97706";

//     // -----------------------------------------
//     // HSDC thông qua backend
//     // -----------------------------------------

//     const response = await fetch("/api/flood");

//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}`);
//     }

//     const data = await response.json();

//     // -----------------------------------------
//     // Kiểm tra dữ liệu
//     // -----------------------------------------

//     if (!data.Content || !Array.isArray(data.Content)) {
//       throw new Error("Dữ liệu HSDC không có Content");
//     }

//     // -----------------------------------------
//     // Lọc điểm hợp lệ
//     // -----------------------------------------

//     floodPoints = data.Content.filter((point) => {
//       const lat = Number(point.Lat);

//       const lng = Number(point.Lng);

//       return (
//         Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
//       );
//     });

//     // -----------------------------------------
//     // Số lượng
//     // -----------------------------------------

//     document.getElementById("floodCount").textContent = floodPoints.length;

//     // -----------------------------------------
//     // Xóa marker cũ
//     // -----------------------------------------

//     floodLayer.clearLayers();

//     // -----------------------------------------
//     // QUAN TRỌNG
//     //
//     // Chờ toàn bộ Open-Meteo load xong
//     // -----------------------------------------

//     await Promise.all(floodPoints.map((point) => addFloodMarker(point)));

//     // -----------------------------------------
//     // Fit map
//     // -----------------------------------------

//     if (floodPoints.length > 0) {
//       const bounds = floodPoints.map((point) => [
//         Number(point.Lat),

//         Number(point.Lng),
//       ]);

//       map.fitBounds(bounds, {
//         padding: [50, 50],
//       });
//     }

//     // -----------------------------------------
//     // Hoàn thành
//     // -----------------------------------------

//     statusElement.textContent = "Đã cập nhật";

//     statusElement.style.color = "#16a34a";
//   } catch (error) {
//     console.error("loadFloodData:", error);

//     const statusElement = document.getElementById("status");

//     statusElement.textContent = "Lỗi";

//     statusElement.style.color = "#dc2626";

//     alert("Không thể tải dữ liệu điểm ngập.\n\n" + error.message);
//   }
// }

// // =====================================================
// // 8. NÚT CẬP NHẬT
// // =====================================================

// document.getElementById("btnReload").addEventListener("click", loadFloodData);

// // =====================================================
// // 9. CHẠY LẦN ĐẦU
// // =====================================================

// loadFloodData();
// =====================================================
// WEBGIS QUẢN LÝ CÁC ĐIỂM NGẬP LỤT TẠI HÀ NỘI
// =====================================================

// =====================================================
// 1. KHỞI TẠO BẢN ĐỒ
// =====================================================

const map = L.map("map", {
  zoomControl: false,
}).setView([21.0285, 105.8542], 12);

L.control
  .zoom({
    position: "bottomright",
  })
  .addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

// =====================================================
// 2. CÁC LAYER
// =====================================================

const floodLayer = L.layerGroup().addTo(map);

const rainStationLayer = L.layerGroup().addTo(map);

const userReportLayer = L.layerGroup().addTo(map);

let reportLocationMarker = null;

let reportLocation = {
  latitude: null,
  longitude: null,
  accuracy: null,
  source: null,
};
const userReportIcon = L.divIcon({
  className: "",

  html: `
    <div class="user-report-marker">
      👤
    </div>
  `,

  iconSize: [38, 38],

  iconAnchor: [19, 38],

  popupAnchor: [0, -38],
});
// =====================================================
// 3. ICON
// =====================================================

// Điểm ngập tham chiếu
const floodIcon = L.divIcon({
  className: "",
  html: `
    <div class="flood-map-marker">
      !
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

// Trạm mưa
const rainStationIcon = L.divIcon({
  className: "",
  html: `
    <div class="rain-map-marker">
      🌧
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

// =====================================================
// 4. BIẾN DỮ LIỆU
// =====================================================

let floodPoints = [];
let rainStations = [];

// =====================================================
// 5. HÀM HỖ TRỢ
// =====================================================

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Không có";
  }

  return Number(value).toFixed(digits);
}

function setReportLocation(lat, lng, accuracy = null, source = "MAP") {
  lat = Number(lat);
  lng = Number(lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  reportLocation = {
    latitude: lat,
    longitude: lng,
    accuracy: accuracy,
    source: source,
  };

  document.getElementById("reportLatitude").value = lat;

  document.getElementById("reportLongitude").value = lng;

  document.getElementById("reportAccuracy").value = accuracy ?? "";

  const locationInfo = document.getElementById("locationInfo");

  locationInfo.innerHTML = `
    <strong>Đã chọn vị trí</strong>
    <br>
    ${lat.toFixed(6)},
    ${lng.toFixed(6)}
    ${
      accuracy !== null
        ? `<br>Sai số GPS: khoảng ${Math.round(accuracy)} m`
        : ""
    }
  `;

  userReportLayer.clearLayers();

  reportLocationMarker = L.marker([lat, lng], {
    icon: userReportIcon,

    draggable: true,
  }).addTo(userReportLayer);

  reportLocationMarker
    .bindPopup(
      `
      <b>Vị trí báo ngập</b>
      <br>
      Bạn có thể kéo marker
      để chỉnh lại vị trí.
    `,
    )
    .openPopup();

  // =========================================
  // Khi người dùng kéo marker
  // =========================================

  reportLocationMarker.on("dragend", function () {
    const position = reportLocationMarker.getLatLng();

    setReportLocation(position.lat, position.lng, null, "MANUAL");
  });

  // Zoom vào vị trí
  map.setView([lat, lng], 17);
}
document.getElementById("btnCurrentLocation").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Trình duyệt không hỗ trợ GPS.");

    return;
  }

  const button = document.getElementById("btnCurrentLocation");

  button.disabled = true;

  button.textContent = "Đang lấy vị trí...";

  navigator.geolocation.getCurrentPosition(
    // SUCCESS
    (position) => {
      const lat = position.coords.latitude;

      const lng = position.coords.longitude;

      const accuracy = position.coords.accuracy;

      setReportLocation(lat, lng, accuracy, "GPS");

      button.disabled = false;

      button.textContent = "📍 Vị trí hiện tại";
    },

    // ERROR
    (error) => {
      console.error(error);

      alert(
        "Không thể lấy vị trí hiện tại.\n" +
          "Hãy bật quyền Location hoặc chọn trên bản đồ.",
      );

      button.disabled = false;

      button.textContent = "📍 Vị trí hiện tại";
    },

    // OPTIONS
    {
      enableHighAccuracy: true,

      timeout: 15000,

      maximumAge: 0,
    },
  );
});
let selectingReportLocation = false;
document.getElementById("btnPickOnMap").addEventListener("click", () => {
  selectingReportLocation = true;

  reportModal.classList.remove("show");

  map.getContainer().style.cursor = "crosshair";

  alert("Hãy click vào vị trí ngập trên bản đồ.");
});
map.on("click", function (event) {
  if (!selectingReportLocation) {
    return;
  }

  selectingReportLocation = false;

  map.getContainer().style.cursor = "";

  setReportLocation(event.latlng.lat, event.latlng.lng, null, "MAP");

  reportModal.classList.add("show");
});
// =====================================================
// 6. OPEN-METEO
// =====================================================

async function getOpenMeteoRain(lat, lng) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,rain` +
      `&timezone=Asia%2FHo_Chi_Minh`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      temperature: data.current?.temperature_2m ?? null,

      humidity: data.current?.relative_humidity_2m ?? null,

      precipitation: data.current?.precipitation ?? null,

      rain: data.current?.rain ?? null,

      time: data.current?.time ?? null,

      meteo_latitude: data.latitude ?? null,

      meteo_longitude: data.longitude ?? null,
    };
  } catch (error) {
    console.error("Lỗi Open-Meteo:", error);

    return {
      temperature: null,
      humidity: null,
      precipitation: null,
      rain: null,
      time: null,
      meteo_latitude: null,
      meteo_longitude: null,
    };
  }
}

// =====================================================
// 7. MARKER ĐIỂM NGẬP
// =====================================================

async function addFloodMarker(point) {
  const lat = Number(point.Lat);
  const lng = Number(point.Lng);

  const rainData = await getOpenMeteoRain(lat, lng);

  const marker = L.marker([lat, lng], {
    icon: floodIcon,
  });

  const rain =
    rainData.rain !== null ? `${rainData.rain} mm` : "Không có dữ liệu";

  const precipitation =
    rainData.precipitation !== null
      ? `${rainData.precipitation} mm`
      : "Không có dữ liệu";

  const temperature =
    rainData.temperature !== null
      ? `${rainData.temperature} °C`
      : "Không có dữ liệu";

  const humidity =
    rainData.humidity !== null ? `${rainData.humidity}%` : "Không có dữ liệu";

  marker.bindPopup(`
    <div class="map-popup">

      <div class="popup-header flood-popup-header">
        <span class="popup-header-icon">
          !
        </span>

        <div>
          <div class="popup-title">
            ${point.TenTram || "Điểm ngập"}
          </div>

          <div class="popup-subtitle">
            Điểm ngập tham chiếu HSDC
          </div>
        </div>
      </div>

      <div class="popup-content">

        <div class="popup-row">
          <span>Mã HSDC</span>
          <strong>
            ${point.TramId ?? "Không có"}
          </strong>
        </div>

        <div class="popup-row">
          <span>Vĩ độ</span>
          <strong>${lat}</strong>
        </div>

        <div class="popup-row">
          <span>Kinh độ</span>
          <strong>${lng}</strong>
        </div>

        <div class="popup-section-title">
          🌧 Thời tiết Open-Meteo
        </div>

        <div class="weather-grid">

          <div class="weather-item">
            <span>Mưa</span>
            <strong>${rain}</strong>
          </div>

          <div class="weather-item">
            <span>Giáng thủy</span>
            <strong>${precipitation}</strong>
          </div>

          <div class="weather-item">
            <span>Nhiệt độ</span>
            <strong>${temperature}</strong>
          </div>

          <div class="weather-item">
            <span>Độ ẩm</span>
            <strong>${humidity}</strong>
          </div>

        </div>

        <div class="popup-time">
          Thời gian:
          ${rainData.time ?? "Không có dữ liệu"}
        </div>

        ${
          rainData.meteo_latitude !== null
            ? `
              <div class="popup-grid-info">
                Grid Open-Meteo:
                ${rainData.meteo_latitude},
                ${rainData.meteo_longitude}
              </div>
            `
            : ""
        }

        <div class="popup-warning">
          Đây là điểm ngập tham chiếu HSDC,
          không đồng nghĩa đang ngập tại thời điểm hiện tại.
        </div>

      </div>

    </div>
  `);

  floodLayer.addLayer(marker);
}

// =====================================================
// 8. LOAD ĐIỂM NGẬP HSDC
// =====================================================

async function loadFloodData() {
  const statusElement = document.getElementById("status");

  try {
    statusElement.textContent = "Đang tải...";

    statusElement.className = "status status-loading";

    const response = await fetch("/api/flood");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.Content || !Array.isArray(data.Content)) {
      throw new Error("Dữ liệu HSDC không hợp lệ");
    }

    floodPoints = data.Content.filter((point) => {
      const lat = Number(point.Lat);

      const lng = Number(point.Lng);

      return (
        Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
      );
    });

    document.getElementById("floodCount").textContent = floodPoints.length;

    floodLayer.clearLayers();

    await Promise.all(floodPoints.map((point) => addFloodMarker(point)));

    statusElement.textContent = "Đã cập nhật";

    statusElement.className = "status status-success";

    if (floodPoints.length > 0) {
      const bounds = floodPoints.map((point) => [
        Number(point.Lat),
        Number(point.Lng),
      ]);

      map.fitBounds(bounds, {
        padding: [60, 60],
      });
    }
  } catch (error) {
    console.error("loadFloodData:", error);

    statusElement.textContent = "Lỗi";

    statusElement.className = "status status-error";
  }
}

// =====================================================
// 9. TRẠM MƯA HSDC
// =====================================================

async function loadRainStations() {
  try {
    const response = await fetch("/api/rain-stations");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    const data = Array.isArray(result) ? result : result.data;

    if (!Array.isArray(data)) {
      throw new Error("Dữ liệu rain station không hợp lệ");
    }

    rainStations = data.filter((station) => {
      if (station.latitude === null || station.longitude === null) {
        return false;
      }

      const lat = Number(station.latitude);

      const lng = Number(station.longitude);

      return (
        Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
      );
    });

    document.getElementById("rainStationCount").textContent =
      rainStations.length;

    rainStationLayer.clearLayers();

    rainStations.forEach((station) => {
      const lat = Number(station.latitude);

      const lng = Number(station.longitude);

      const marker = L.marker([lat, lng], {
        icon: rainStationIcon,
      });

      marker.bindPopup(`
          <div class="map-popup">

            <div class="
              popup-header
              rain-popup-header
            ">

              <span class="
                popup-header-icon
              ">
                🌧
              </span>

              <div>

                <div class="
                  popup-title
                ">
                  ${station.name}
                </div>

                <div class="
                  popup-subtitle
                ">
                  Trạm mưa HSDC
                </div>

              </div>

            </div>

            <div class="
              popup-content
            ">

              <div class="
                popup-row
              ">
                <span>
                  Mã trạm
                </span>

                <strong>
                  ${station.hsdc_rain_id ?? station.station_id ?? "Không có"}
                </strong>
              </div>

              <div class="
                popup-row
              ">
                <span>
                  Địa chỉ
                </span>

                <strong>
                  ${station.address ?? "Không có"}
                </strong>
              </div>

              <div class="
                popup-row
              ">
                <span>
                  Tọa độ
                </span>

                <strong>
                  ${lat},
                  ${lng}
                </strong>
              </div>

              ${
                station.geocode_status
                  ? `
                    <div class="
                      popup-row
                    ">
                      <span>
                        Geocode
                      </span>

                      <strong>
                        ${station.geocode_status}
                      </strong>
                    </div>
                  `
                  : ""
              }

            </div>

          </div>
        `);

      rainStationLayer.addLayer(marker);
    });
  } catch (error) {
    console.warn("Chưa tải được rain stations:", error.message);

    document.getElementById("rainStationCount").textContent = "0";
  }
}

// =====================================================
// 10. CHECKBOX LAYER
// =====================================================

document
  .getElementById("toggleFloodLayer")
  .addEventListener("change", function () {
    if (this.checked) {
      map.addLayer(floodLayer);
    } else {
      map.removeLayer(floodLayer);
    }
  });

document
  .getElementById("toggleRainLayer")
  .addEventListener("change", function () {
    if (this.checked) {
      map.addLayer(rainStationLayer);
    } else {
      map.removeLayer(rainStationLayer);
    }
  });

// =====================================================
// 11. MODAL BÁO NGẬP
// =====================================================

const reportModal = document.getElementById("reportModal");

document.getElementById("btnReport").addEventListener("click", () => {
  reportModal.classList.add("show");
});

document.getElementById("btnCloseReport").addEventListener("click", () => {
  reportModal.classList.remove("show");
});

document.getElementById("btnCancelReport").addEventListener("click", () => {
  reportModal.classList.remove("show");
});

reportModal.addEventListener("click", (event) => {
  if (event.target === reportModal) {
    reportModal.classList.remove("show");
  }
});

// =====================================================
// 12. FORM BÁO NGẬP
// =====================================================

document.getElementById("reportForm").addEventListener("submit", (event) => {
  event.preventDefault();

  alert(
    "Form giao diện đã hoạt động.\n" +
      "Bước tiếp theo sẽ nối API lưu báo cáo vào PostgreSQL.",
  );

  reportModal.classList.remove("show");
});

// =====================================================
// 13. RELOAD
// =====================================================

async function reloadAllData() {
  await Promise.all([loadFloodData(), loadRainStations()]);
}

document.getElementById("btnReload").addEventListener("click", reloadAllData);

// =====================================================
// 14. LOAD LẦN ĐẦU
// =====================================================

reloadAllData();
