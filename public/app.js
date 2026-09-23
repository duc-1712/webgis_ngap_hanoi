// =====================================================
// FLOODGIS HÀ NỘI
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
// 2. LAYER
// =====================================================

const floodLayer = L.layerGroup().addTo(map);

const rainStationLayer = L.layerGroup().addTo(map);

const userReportLayer = L.layerGroup().addTo(map);

// Layer riêng cho marker đang chọn vị trí báo ngập
const reportDraftLayer = L.layerGroup().addTo(map);

// =====================================================
// 3. ICON
// =====================================================

const floodIcon = L.divIcon({
  className: "",

  html: `
    <div class="flood-map-marker">
      !
    </div>
  `,

  iconSize: [32, 32],

  iconAnchor: [16, 16],

  popupAnchor: [0, -17],
});

const rainStationIcon = L.divIcon({
  className: "",

  html: `
    <div class="rain-map-marker">
      🌧
    </div>
  `,

  iconSize: [32, 32],

  iconAnchor: [16, 16],

  popupAnchor: [0, -17],
});

const reportLocationIcon = L.divIcon({
  className: "",

  html: `
    <div class="report-location-marker">
      📍
    </div>
  `,

  iconSize: [36, 36],

  iconAnchor: [18, 18],

  popupAnchor: [0, -18],
});

const pendingReportIcon = L.divIcon({
  className: "",

  html: `
    <div class="
      user-flood-marker
      user-flood-pending
    ">
      👤
    </div>
  `,

  iconSize: [34, 34],

  iconAnchor: [17, 17],

  popupAnchor: [0, -18],
});

const verifiedReportIcon = L.divIcon({
  className: "",

  html: `
    <div class="
      user-flood-marker
      user-flood-verified
    ">
      ✓
    </div>
  `,

  iconSize: [34, 34],

  iconAnchor: [17, 17],

  popupAnchor: [0, -18],
});

const rejectedReportIcon = L.divIcon({
  className: "",

  html: `
    <div class="
      user-flood-marker
      user-flood-rejected
    ">
      ×
    </div>
  `,

  iconSize: [34, 34],

  iconAnchor: [17, 17],

  popupAnchor: [0, -18],
});

// =====================================================
// 4. BIẾN
// =====================================================

let floodPoints = [];

let rainStations = [];

let userReports = [];

let selectingReportLocation = false;

let reportLocationMarker = null;

let imagePreviewUrl = null;

let initialMapFitDone = false;

let reportLocation = {
  latitude: null,
  longitude: null,
  accuracy: null,
  source: null,
};

const floodMarkerMap = new Map();

const weatherCache = new Map();

// =====================================================
// 5. DOM
// =====================================================

const reportModal = document.getElementById("reportModal");

const reportForm = document.getElementById("reportForm");

const mapSelectMessage = document.getElementById("mapSelectMessage");

const statusElement = document.getElementById("status");

const lastUpdateElement = document.getElementById("lastUpdate");

const pointListElement = document.getElementById("pointList");

const searchInput = document.getElementById("searchInput");

// =====================================================
// 6. HÀM HỖ TRỢ
// =====================================================

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/[&<>'"]/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#039;",
      '"': "&quot;",
    };

    return entities[char];
  });
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Không có";
  }

  return Number(value).toFixed(digits);
}

function formatDateTime(value) {
  if (!value) {
    return "Không có";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("vi-VN");
}

function setStatus(text, type = "loading") {
  statusElement.textContent = text;

  if (type === "success") {
    statusElement.className = "status-success";
  } else if (type === "error") {
    statusElement.className = "status-error";
  } else {
    statusElement.className = "status-loading";
  }
}

function pointKey(point) {
  if (point.TramId !== null && point.TramId !== undefined) {
    return String(point.TramId);
  }

  return `${point.Lat}_${point.Lng}`;
}

function safeImageUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function floodLevelLabel(value) {
  const labels = {
    LIGHT: "Ngập nhẹ",

    MEDIUM: "Ngập trung bình",

    HEAVY: "Ngập nặng",

    BLOCKED: "Không thể lưu thông",
  };

  return labels[value] || value || "Không có";
}

function trafficStatusLabel(value) {
  const labels = {
    NORMAL: "Bình thường",

    SLOW: "Di chuyển chậm",

    CONGESTED: "Ùn tắc",

    BLOCKED: "Không thể đi qua",
  };

  return labels[value] || value || "Không có";
}

function reportStatusLabel(value) {
  const labels = {
    PENDING: "Chờ xác minh",

    VERIFIED: "Đã xác minh",

    REJECTED: "Đã từ chối",

    STALE: "Đã hết hiệu lực",
  };

  return labels[value] || value || "Không rõ";
}

function getReportIcon(status) {
  if (status === "VERIFIED") {
    return verifiedReportIcon;
  }

  if (status === "REJECTED") {
    return rejectedReportIcon;
  }

  return pendingReportIcon;
}

function showMapSelectMessage(text, autoHideMs = 0) {
  mapSelectMessage.textContent = text;

  mapSelectMessage.classList.add("show");

  if (autoHideMs > 0) {
    window.setTimeout(() => {
      mapSelectMessage.classList.remove("show");
    }, autoHideMs);
  }
}

function hideMapSelectMessage() {
  mapSelectMessage.classList.remove("show");
}

// =====================================================
// 7. OPEN-METEO
// =====================================================

async function getOpenMeteoRain(lat, lng) {
  const cacheKey = `${Number(lat).toFixed(4)},` + `${Number(lng).toFixed(4)}`;

  const cached = weatherCache.get(cacheKey);

  // cache 5 phút
  if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
    return cached.data;
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lng)}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,rain` +
      `&timezone=Asia%2FHo_Chi_Minh`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }

    const raw = await response.json();

    const data = {
      temperature: raw.current?.temperature_2m ?? null,

      humidity: raw.current?.relative_humidity_2m ?? null,

      precipitation: raw.current?.precipitation ?? null,

      rain: raw.current?.rain ?? null,

      time: raw.current?.time ?? null,

      meteoLatitude: raw.latitude ?? null,

      meteoLongitude: raw.longitude ?? null,
    };

    weatherCache.set(cacheKey, {
      data,
      cachedAt: Date.now(),
    });

    return data;
  } catch (error) {
    console.error("Lỗi Open-Meteo:", error);

    return {
      temperature: null,
      humidity: null,
      precipitation: null,
      rain: null,
      time: null,
      meteoLatitude: null,
      meteoLongitude: null,
    };
  }
}

// =====================================================
// 8. MARKER ĐIỂM HSDC
// =====================================================

function addFloodMarker(point) {
  const lat = Number(point.Lat);

  const lng = Number(point.Lng);

  const key = pointKey(point);

  const weatherElementId = `weather-hsdc-${key.replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  )}`;

  const marker = L.marker([lat, lng], {
    icon: floodIcon,
  });

  marker.bindPopup(`
    <div class="popup-title">
      ${escapeHtml(point.TenTram || "Điểm ngập HSDC")}
    </div>

    <div class="popup-row">
      <b>Mã HSDC:</b>
      ${escapeHtml(point.TramId ?? "Không có")}
    </div>

    <div class="popup-row">
      <b>Tọa độ:</b>
      ${lat.toFixed(6)},
      ${lng.toFixed(6)}
    </div>

    <hr>

    <div
      id="${weatherElementId}"
      class="popup-row"
    >
      🌧 Đang tải dữ liệu Open-Meteo...
    </div>

    <div class="popup-warning">
      Đây là điểm ngập tham chiếu HSDC,
      không đồng nghĩa đang ngập tại
      thời điểm hiện tại.
    </div>
  `);

  marker.on("popupopen", async () => {
    const weatherElement = document.getElementById(weatherElementId);

    if (!weatherElement) {
      return;
    }

    const weather = await getOpenMeteoRain(lat, lng);

    weatherElement.innerHTML = `
        <div>
          <b>
            🌧 Open-Meteo
          </b>
        </div>

        <div>
          Mưa:
          <b>
            ${formatNumber(weather.rain)} mm
          </b>
        </div>

        <div>
          Giáng thủy:
          <b>
            ${formatNumber(weather.precipitation)} mm
          </b>
        </div>

        <div>
          Nhiệt độ:
          <b>
            ${formatNumber(weather.temperature, 1)} °C
          </b>
        </div>

        <div>
          Độ ẩm:
          <b>
            ${formatNumber(weather.humidity, 0)}%
          </b>
        </div>

        <div>
          Thời gian:
          ${escapeHtml(weather.time || "Không có")}
        </div>

        ${
          weather.meteoLatitude !== null
            ? `
              <div>
                Grid:
                ${formatNumber(weather.meteoLatitude, 5)},
                ${formatNumber(weather.meteoLongitude, 5)}
              </div>
            `
            : ""
        }
      `;
  });

  floodLayer.addLayer(marker);

  floodMarkerMap.set(key, marker);
}

// =====================================================
// 9. DANH SÁCH HSDC
// =====================================================

function renderFloodPointList(points) {
  document.getElementById("resultCount").textContent = points.length;

  if (points.length === 0) {
    pointListElement.innerHTML = `
      <div class="loading">
        Không tìm thấy điểm phù hợp.
      </div>
    `;

    return;
  }

  pointListElement.innerHTML = points
    .map((point) => {
      const lat = Number(point.Lat);

      const lng = Number(point.Lng);

      const key = pointKey(point);

      return `
          <div
            class="point-item"
            data-point-key="${escapeHtml(key)}"
          >

            <div class="point-name">
              ${escapeHtml(point.TenTram || "Điểm HSDC")}
            </div>

            <div class="point-info">

              HSDC #
              ${escapeHtml(point.TramId ?? "-")}

              ·

              ${lat.toFixed(5)},
              ${lng.toFixed(5)}

            </div>

          </div>
        `;
    })
    .join("");

  pointListElement.querySelectorAll(".point-item").forEach((item) => {
    item.addEventListener("click", () => {
      const key = item.dataset.pointKey;

      const marker = floodMarkerMap.get(key);

      if (!marker) {
        return;
      }

      if (!map.hasLayer(floodLayer)) {
        map.addLayer(floodLayer);

        document.getElementById("showFlood").checked = true;
      }

      map.setView(marker.getLatLng(), 17);

      marker.openPopup();
    });
  });
}

function filterFloodPointList() {
  const keyword = searchInput.value.trim().toLowerCase();

  if (!keyword) {
    renderFloodPointList(floodPoints);

    return;
  }

  const filtered = floodPoints.filter((point) => {
    const name = String(point.TenTram || "").toLowerCase();

    const id = String(point.TramId ?? "").toLowerCase();

    return name.includes(keyword) || id.includes(keyword);
  });

  renderFloodPointList(filtered);
}

// =====================================================
// 10. LOAD HSDC
// =====================================================

async function loadFloodData() {
  const response = await fetch("/api/flood");

  if (!response.ok) {
    throw new Error(`Không tải được HSDC - HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.Content || !Array.isArray(data.Content)) {
    throw new Error("Dữ liệu HSDC không có Content hợp lệ");
  }

  floodPoints = data.Content.filter((point) => {
    const lat = Number(point.Lat);

    const lng = Number(point.Lng);

    return (
      Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
    );
  });

  document.getElementById("totalPoints").textContent = floodPoints.length;

  floodLayer.clearLayers();

  floodMarkerMap.clear();

  floodPoints.forEach(addFloodMarker);

  filterFloodPointList();

  if (!initialMapFitDone && floodPoints.length > 0) {
    const bounds = floodPoints.map((point) => [
      Number(point.Lat),
      Number(point.Lng),
    ]);

    map.fitBounds(bounds, {
      padding: [40, 40],
    });

    initialMapFitDone = true;
  }
}

// =====================================================
// 11. LOAD TRẠM MƯA
// =====================================================

async function loadRainStations() {
  const response = await fetch("/api/rain-stations");

  if (!response.ok) {
    throw new Error(`Không tải được trạm mưa - HTTP ${response.status}`);
  }

  const result = await response.json();

  const data = Array.isArray(result) ? result : result.data;

  if (!Array.isArray(data)) {
    throw new Error("Dữ liệu rain_stations không hợp lệ");
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

  document.getElementById("rainStationCount").textContent = rainStations.length;

  rainStationLayer.clearLayers();

  rainStations.forEach((station) => {
    const lat = Number(station.latitude);

    const lng = Number(station.longitude);

    const marker = L.marker([lat, lng], {
      icon: rainStationIcon,
    });

    marker.bindPopup(`
        <div class="popup-title">
          🌧
          ${escapeHtml(station.name || "Trạm mưa HSDC")}
        </div>

        <div class="popup-row">
          <b>Mã trạm:</b>

          ${escapeHtml(
            station.hsdc_rain_id ?? station.station_id ?? "Không có",
          )}
        </div>

        <div class="popup-row">
          <b>Địa chỉ:</b>

          ${escapeHtml(station.address || "Không có")}
        </div>

        <div class="popup-row">
          <b>Tọa độ:</b>

          ${lat.toFixed(6)},
          ${lng.toFixed(6)}
        </div>

        ${
          station.geocode_status
            ? `
              <div class="popup-row">

                <b>
                  Geocode:
                </b>

                ${escapeHtml(station.geocode_status)}

              </div>
            `
            : ""
        }
      `);

    rainStationLayer.addLayer(marker);
  });
}

// =====================================================
// 12. LOAD BÁO CÁO USER
// =====================================================

async function loadUserReports() {
  const response = await fetch("/api/flood-reports");

  if (!response.ok) {
    throw new Error(`Không tải được báo cáo - HTTP ${response.status}`);
  }

  const result = await response.json();

  const data = Array.isArray(result) ? result : result.data;

  if (!Array.isArray(data)) {
    throw new Error("Dữ liệu flood-reports không hợp lệ");
  }

  userReports = data.filter((report) => {
    const lat = Number(report.latitude);

    const lng = Number(report.longitude);

    return (
      Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
    );
  });

  document.getElementById("reportCount").textContent = userReports.length;

  userReportLayer.clearLayers();

  userReports.forEach((report) => {
    const lat = Number(report.latitude);

    const lng = Number(report.longitude);

    const imageUrl = safeImageUrl(report.image_url);

    const marker = L.marker([lat, lng], {
      icon: getReportIcon(report.status),
    });

    marker.bindPopup(`
        <div class="popup-title">
          👤 Báo cáo ngập từ người dùng
        </div>

        <div class="popup-row">
          <b>Trạng thái:</b>

          ${escapeHtml(reportStatusLabel(report.status))}
        </div>

        <div class="popup-row">
          <b>Địa điểm:</b>

          ${escapeHtml(report.address || "Không có mô tả địa điểm")}
        </div>

        <div class="popup-row">
          <b>Mức ngập:</b>

          ${escapeHtml(floodLevelLabel(report.flood_level))}
        </div>

        <div class="popup-row">
          <b>Giao thông:</b>

          ${escapeHtml(trafficStatusLabel(report.traffic_status))}
        </div>

        <div class="popup-row">
          <b>Thời gian:</b>

          ${escapeHtml(formatDateTime(report.reported_at))}
        </div>

        ${
          report.description
            ? `
              <div class="popup-row">

                <b>
                  Ghi chú:
                </b>

                ${escapeHtml(report.description)}

              </div>
            `
            : ""
        }

        ${
          imageUrl
            ? `
              <img
                class="report-popup-image"
                src="${escapeHtml(imageUrl)}"
                alt="Ảnh hiện trường"
              >
            `
            : ""
        }

        ${
          report.status === "PENDING"
            ? `
              <div class="popup-warning">
                Báo cáo này chưa được xác minh.
              </div>
            `
            : ""
        }
      `);

    userReportLayer.addLayer(marker);
  });
}

// =====================================================
// 13. CHECKBOX LAYER
// =====================================================

document.getElementById("showFlood").addEventListener("change", function () {
  if (this.checked) {
    map.addLayer(floodLayer);
  } else {
    map.removeLayer(floodLayer);
  }
});

document
  .getElementById("showRainStations")
  .addEventListener("change", function () {
    if (this.checked) {
      map.addLayer(rainStationLayer);
    } else {
      map.removeLayer(rainStationLayer);
    }
  });

document
  .getElementById("showUserReports")
  .addEventListener("change", function () {
    if (this.checked) {
      map.addLayer(userReportLayer);
    } else {
      map.removeLayer(userReportLayer);
    }
  });

// =====================================================
// 14. SEARCH
// =====================================================

searchInput.addEventListener("input", filterFloodPointList);

// =====================================================
// 15. MODAL
// =====================================================

function openReportModal() {
  reportModal.classList.add("show");
}

function closeReportModal() {
  reportModal.classList.remove("show");
}

function clearReportDraftMarker() {
  reportDraftLayer.clearLayers();

  reportLocationMarker = null;
}

function resetReportForm() {
  reportForm.reset();

  reportLocation = {
    latitude: null,
    longitude: null,
    accuracy: null,
    source: null,
  };

  document.getElementById("reportLatitude").value = "";

  document.getElementById("reportLongitude").value = "";

  document.getElementById("reportAccuracy").value = "";

  const locationInfo = document.getElementById("locationInfo");

  locationInfo.textContent = "Chưa chọn vị trí";

  locationInfo.classList.remove("location-selected");

  clearReportDraftMarker();

  if (imagePreviewUrl) {
    URL.revokeObjectURL(imagePreviewUrl);

    imagePreviewUrl = null;
  }

  document.getElementById("imagePreview").removeAttribute("src");

  document.getElementById("imagePreviewContainer").classList.remove("show");
}

document.getElementById("btnReportFlood").addEventListener("click", () => {
  openReportModal();
});

document.getElementById("btnCloseReport").addEventListener("click", () => {
  closeReportModal();
});

document.getElementById("btnCancelReport").addEventListener("click", () => {
  closeReportModal();

  resetReportForm();
});

reportModal.addEventListener("click", (event) => {
  if (event.target === reportModal) {
    closeReportModal();
  }
});

// =====================================================
// 16. CHỌN VỊ TRÍ
// =====================================================

function setReportLocation(
  lat,
  lng,
  accuracy = null,
  source = "MAP",
  zoom = true,
) {
  lat = Number(lat);

  lng = Number(lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  reportLocation = {
    latitude: lat,

    longitude: lng,

    accuracy: accuracy === null ? null : Number(accuracy),

    source,
  };

  document.getElementById("reportLatitude").value = lat;

  document.getElementById("reportLongitude").value = lng;

  document.getElementById("reportAccuracy").value =
    accuracy === null ? "" : accuracy;

  const locationInfo = document.getElementById("locationInfo");

  locationInfo.classList.add("location-selected");

  locationInfo.innerHTML = `
    <strong>
      ✓ Đã chọn vị trí
    </strong>

    <br>

    ${lat.toFixed(6)},
    ${lng.toFixed(6)}

    ${
      accuracy !== null
        ? `
          <br>
          Sai số GPS khoảng
          ${Math.round(Number(accuracy))} m
        `
        : ""
    }

    <br>

    Nguồn vị trí:
    ${escapeHtml(source)}
  `;

  if (!reportLocationMarker) {
    reportLocationMarker = L.marker([lat, lng], {
      icon: reportLocationIcon,

      draggable: true,

      zIndexOffset: 1500,
    }).addTo(reportDraftLayer);

    reportLocationMarker.bindPopup(`
      <b>
        Vị trí báo ngập
      </b>

      <br>

      Có thể kéo marker
      để chỉnh lại vị trí.
    `);

    reportLocationMarker.on("dragend", () => {
      const position = reportLocationMarker.getLatLng();

      setReportLocation(position.lat, position.lng, null, "MANUAL", false);
    });
  } else {
    reportLocationMarker.setLatLng([lat, lng]);
  }

  if (zoom) {
    map.setView([lat, lng], 17);
  }
}

// =====================================================
// 17. GPS
// =====================================================

document.getElementById("btnCurrentLocation").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Trình duyệt không hỗ trợ lấy vị trí hiện tại.");

    return;
  }

  const button = document.getElementById("btnCurrentLocation");

  const originalText = button.textContent;

  button.disabled = true;

  button.textContent = "Đang lấy vị trí...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setReportLocation(
        position.coords.latitude,

        position.coords.longitude,

        position.coords.accuracy,

        "GPS",

        true,
      );

      button.disabled = false;

      button.textContent = originalText;
    },

    (error) => {
      console.error("Geolocation:", error);

      let message = "Không thể lấy vị trí hiện tại.";

      if (error.code === 1) {
        message += " Hãy cấp quyền Location cho trình duyệt.";
      } else if (error.code === 2) {
        message += " Không xác định được vị trí thiết bị.";
      } else if (error.code === 3) {
        message += " Quá thời gian lấy vị trí.";
      }

      alert(message + " Bạn vẫn có thể chọn vị trí trên bản đồ.");

      button.disabled = false;

      button.textContent = originalText;
    },

    {
      enableHighAccuracy: true,

      timeout: 15000,

      maximumAge: 0,
    },
  );
});

// =====================================================
// 18. CHỌN TRÊN MAP
// =====================================================

document.getElementById("btnPickOnMap").addEventListener("click", () => {
  selectingReportLocation = true;

  closeReportModal();

  map.getContainer().style.cursor = "crosshair";

  showMapSelectMessage("📍 Click vào bản đồ để chọn vị trí ngập");
});

map.on("click", (event) => {
  if (!selectingReportLocation) {
    return;
  }

  selectingReportLocation = false;

  map.getContainer().style.cursor = "";

  hideMapSelectMessage();

  setReportLocation(event.latlng.lat, event.latlng.lng, null, "MAP", true);

  window.setTimeout(() => {
    openReportModal();
  }, 500);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (selectingReportLocation) {
    selectingReportLocation = false;

    map.getContainer().style.cursor = "";

    hideMapSelectMessage();

    openReportModal();

    return;
  }

  if (reportModal.classList.contains("show")) {
    closeReportModal();
  }
});

// =====================================================
// 19. PREVIEW ẢNH
// =====================================================

document.getElementById("reportImage").addEventListener("change", function () {
  const file = this.files?.[0];

  const previewContainer = document.getElementById("imagePreviewContainer");

  const preview = document.getElementById("imagePreview");

  if (!file) {
    previewContainer.classList.remove("show");

    preview.removeAttribute("src");

    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    alert("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.");

    this.value = "";

    previewContainer.classList.remove("show");

    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Ảnh không được vượt quá 5 MB.");

    this.value = "";

    previewContainer.classList.remove("show");

    return;
  }

  if (imagePreviewUrl) {
    URL.revokeObjectURL(imagePreviewUrl);
  }

  imagePreviewUrl = URL.createObjectURL(file);

  preview.src = imagePreviewUrl;

  previewContainer.classList.add("show");
});

// =====================================================
// 20. SUBMIT BÁO CÁO
// =====================================================

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (reportLocation.latitude === null || reportLocation.longitude === null) {
    alert("Vui lòng lấy vị trí hiện tại hoặc chọn vị trí trên bản đồ.");

    return;
  }

  const floodLevel = document.getElementById("reportFloodLevel").value;

  const trafficStatus = document.getElementById("reportTraffic").value;

  const address = document.getElementById("reportAddress").value.trim();

  const description = document.getElementById("reportDescription").value.trim();

  const imageInput = document.getElementById("reportImage");

  const imageFile = imageInput.files?.[0] || null;

  if (!floodLevel) {
    alert("Vui lòng chọn mức độ ngập.");

    return;
  }

  if ((floodLevel === "HEAVY" || floodLevel === "BLOCKED") && !imageFile) {
    alert("Báo cáo ngập nặng hoặc không thể lưu thông cần có ảnh hiện trường.");

    return;
  }

  const formData = new FormData();

  formData.append("latitude", reportLocation.latitude);

  formData.append("longitude", reportLocation.longitude);

  formData.append("location_accuracy", reportLocation.accuracy ?? "");

  formData.append("location_source", reportLocation.source || "MAP");

  formData.append("address", address);

  formData.append("flood_level", floodLevel);

  formData.append("traffic_status", trafficStatus);

  formData.append("description", description);

  if (imageFile) {
    formData.append("image", imageFile);
  }

  const submitButton = reportForm.querySelector(".submit-btn");

  const originalText = submitButton.textContent;

  submitButton.disabled = true;

  submitButton.textContent = "Đang gửi...";

  try {
    const response = await fetch("/api/flood-reports", {
      method: "POST",

      body: formData,
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || `HTTP ${response.status}`);
    }

    const submittedLat = reportLocation.latitude;

    const submittedLng = reportLocation.longitude;

    closeReportModal();

    resetReportForm();

    await loadUserReports();

    if (!map.hasLayer(userReportLayer)) {
      map.addLayer(userReportLayer);

      document.getElementById("showUserReports").checked = true;
    }

    map.setView([submittedLat, submittedLng], 17);

    alert("Đã gửi báo cáo. Báo cáo đang ở trạng thái chờ xác minh.");
  } catch (error) {
    console.error("POST /api/flood-reports:", error);

    alert(`Không thể gửi báo cáo.\n\n${error.message}`);
  } finally {
    submitButton.disabled = false;

    submitButton.textContent = originalText;
  }
});

// =====================================================
// 21. RELOAD TOÀN BỘ
// =====================================================

async function reloadAllData() {
  const reloadButton = document.getElementById("btnReload");

  const originalText = reloadButton.textContent;

  reloadButton.disabled = true;

  reloadButton.textContent = "Đang tải...";

  setStatus("Đang tải...", "loading");

  const results = await Promise.allSettled([
    loadFloodData(),

    loadRainStations(),

    loadUserReports(),
  ]);

  const failed = results.filter((result) => result.status === "rejected");

  failed.forEach((result) => {
    console.error("Reload error:", result.reason);
  });

  if (failed.length === 0) {
    setStatus("Đã cập nhật", "success");
  } else if (failed.length < results.length) {
    setStatus("Thiếu một phần dữ liệu", "loading");
  } else {
    setStatus("Lỗi tải dữ liệu", "error");
  }

  lastUpdateElement.textContent =
    `Cập nhật: ` + new Date().toLocaleString("vi-VN");

  reloadButton.disabled = false;

  reloadButton.textContent = originalText;
}

// =====================================================
// 22. NÚT RELOAD
// =====================================================

document.getElementById("btnReload").addEventListener("click", reloadAllData);

// =====================================================
// 23. CHẠY
// =====================================================

reloadAllData();
