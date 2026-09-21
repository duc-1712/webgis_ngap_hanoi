const axios = require("axios");
const fs = require("fs");
const path = require("path");

// =====================================================
// CẤU HÌNH
// =====================================================

const INPUT_FILE = path.join(__dirname, "hsdc-rain-stations.json");

const OUTPUT_FILE = path.join(__dirname, "hsdc-rain-stations-geocoded.json");

const NOMINATIM_API = "https://nominatim.openstreetmap.org/search";

const DELAY_MS = 1200;

// =====================================================
// QUERY RIÊNG CHO CÁC ĐỊA CHỈ VIẾT TẮT / KHÓ TÌM
// =====================================================

const SPECIAL_QUERIES = {
  61: ["Hồ CV1 Cầu Giấy, Hà Nội, Việt Nam"],

  3: ["110 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội, Việt Nam"],

  1: [
    "65 Vân Hồ III, Hai Bà Trưng, Hà Nội, Việt Nam",
    "Vân Hồ 3, Hai Bà Trưng, Hà Nội, Việt Nam",
  ],

  14: [
    "Hồ Đống Đa, Ô Chợ Dừa, Hà Nội, Việt Nam",
    "Trạm bơm Hồ Đống Đa, Hà Nội, Việt Nam",
  ],

  16: ["Đầm Chuối, Bùi Xương Trạch, Khương Đình, Hà Nội, Việt Nam"],

  // QUAN TRỌNG:
  // tránh trường hợp tìm nhầm "Trần Phú" ở nơi khác
  18: [
    "Trạm bơm Trần Phú, Lĩnh Nam, Hoàng Mai, Hà Nội, Việt Nam",
    "Trần Phú, Lĩnh Nam, Hoàng Mai, Hà Nội, Việt Nam",
  ],

  4: [
    "Nhà văn hóa Mai Dịch, Hà Nội, Việt Nam",
    "Mai Dịch, Cầu Giấy, Hà Nội, Việt Nam",
  ],

  8: ["CĐT HT A, Tây Hồ, Hà Nội, Việt Nam"],

  25: ["Trạm bơm Đồng Bông 1, Từ Liêm, Hà Nội, Việt Nam"],

  26: ["Hầm chui đường sắt, Tây Mỗ, Hà Nội, Việt Nam"],

  21: [
    "TT5A Lô 15 KĐT Văn Phú, Hà Đông, Hà Nội, Việt Nam",
    "Khu đô thị Văn Phú, Hà Đông, Hà Nội, Việt Nam",
  ],

  23: ["222 Khu dịch vụ A, Yên Nghĩa, Hà Đông, Hà Nội, Việt Nam"],

  43: ["1 Thuận An, Trâu Quỳ, Gia Lâm, Hà Nội, Việt Nam"],

  44: [
    "UBND thị trấn Yên Viên, Gia Lâm, Hà Nội, Việt Nam",
    "Yên Viên, Gia Lâm, Hà Nội, Việt Nam",
  ],

  41: [
    "UBND xã Mai Lâm, Đông Anh, Hà Nội, Việt Nam",
    "Mai Lâm, Đông Anh, Hà Nội, Việt Nam",
  ],

  36: [
    "UBND thị trấn Xuân Mai, Chương Mỹ, Hà Nội, Việt Nam",
    "Xuân Mai, Chương Mỹ, Hà Nội, Việt Nam",
  ],

  7: [
    "Đập Thanh Liệt, Cầu Tó, Thanh Trì, Hà Nội, Việt Nam",
    "Cầu Tó, Thanh Liệt, Hà Nội, Việt Nam",
  ],

  32: [
    "UBND thị trấn Phú Xuyên, Hà Nội, Việt Nam",
    "Thị trấn Phú Xuyên, Hà Nội, Việt Nam",
  ],
};

// =====================================================
// DELAY
// =====================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// =====================================================
// CHUẨN HÓA TEXT
// =====================================================

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// =====================================================
// TÍNH MỨC ĐỘ KHỚP ĐỊA CHỈ
// =====================================================

function calculateAddressScore(address, displayName) {
  const addressNormalized = normalizeText(address);

  const displayNormalized = normalizeText(displayName);

  if (!addressNormalized) {
    return 0;
  }

  const ignoreWords = new Set([
    "tb",
    "nvh",
    "kdt",
    "tt",
    "so",
    "ngo",
    "duong",
    "pho",
    "ha",
    "noi",
  ]);

  const words = addressNormalized.split(" ").filter((word) => {
    return word.length >= 2 && !ignoreWords.has(word);
  });

  if (words.length === 0) {
    return 0;
  }

  let matched = 0;

  for (const word of words) {
    if (displayNormalized.includes(word)) {
      matched++;
    }
  }

  return matched / words.length;
}

// =====================================================
// KIỂM TRA CÓ NẰM TRONG KHU VỰC HÀ NỘI HAY KHÔNG
// =====================================================

function isInHanoiArea(lat, lon) {
  // Bounding box khá rộng của Hà Nội
  return lat >= 20.4 && lat <= 21.7 && lon >= 105.2 && lon <= 106.2;
}

// =====================================================
// KIỂM TRA KẾT QUẢ GEOCODE
// =====================================================

function evaluateResult(station, result) {
  const lat = Number(result.lat);
  const lon = Number(result.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      accepted: false,
      status: "MISSING",
      score: 0,
    };
  }

  if (!isInHanoiArea(lat, lon)) {
    return {
      accepted: false,
      status: "REJECTED_OUTSIDE_HANOI",
      score: 0,
    };
  }

  const displayName = result.display_name || "";

  const normalizedDisplay = normalizeText(displayName);

  const normalizedName = normalizeText(station.name);

  const nameMatch =
    normalizedName && normalizedDisplay.includes(normalizedName);

  const addressScore = calculateAddressScore(station.address, displayName);

  // -----------------------------------------
  // Trường hợp rất đáng tin
  // -----------------------------------------

  if (nameMatch && addressScore >= 0.4) {
    return {
      accepted: true,
      status: "SAFE",
      score: addressScore,
    };
  }

  // -----------------------------------------
  // Địa chỉ match tốt
  // -----------------------------------------

  if (addressScore >= 0.6) {
    return {
      accepted: true,
      status: "SAFE",
      score: addressScore,
    };
  }

  // -----------------------------------------
  // Có tên khu vực hoặc địa chỉ match tương đối
  // -----------------------------------------

  if (nameMatch || addressScore >= 0.35) {
    return {
      accepted: true,
      status: "REVIEW",
      score: addressScore,
    };
  }

  // -----------------------------------------
  // Không đủ tin cậy → KHÔNG NHẬN
  // -----------------------------------------

  return {
    accepted: false,
    status: "REJECTED_LOW_CONFIDENCE",
    score: addressScore,
  };
}

// =====================================================
// GỌI NOMINATIM
// =====================================================

async function searchLocation(query) {
  try {
    console.log(`   → Tìm: ${query}`);

    const response = await axios.get(NOMINATIM_API, {
      params: {
        q: query,
        format: "jsonv2",

        // lấy nhiều hơn 1 kết quả để chọn
        limit: 5,

        countrycodes: "vn",

        addressdetails: 1,
      },

      headers: {
        "User-Agent": "webgis-ngap-ha-noi-student-project/1.0",

        "Accept-Language": "vi,en;q=0.9",
      },

      timeout: 30000,
    });

    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }

    return [];
  } catch (error) {
    console.error("   ✗ Lỗi geocode:", error.message);

    return [];
  }
}

// =====================================================
// TẠO DANH SÁCH QUERY
// =====================================================

function buildQueries(station) {
  const queries = [];

  // -----------------------------------------
  // Query custom ưu tiên trước
  // -----------------------------------------

  if (SPECIAL_QUERIES[station.station_id]) {
    queries.push(...SPECIAL_QUERIES[station.station_id]);
  }

  // -----------------------------------------
  // Query mặc định
  // -----------------------------------------

  if (station.address && station.name) {
    queries.push(`${station.address}, ${station.name}, Hà Nội, Việt Nam`);
  }

  if (station.address) {
    queries.push(`${station.address}, Hà Nội, Việt Nam`);
  }

  // QUAN TRỌNG:
  // KHÔNG dùng:
  //
  // `${station.name}, Hà Nội`
  //
  // vì dễ trả về tâm phường/xã.

  return [...new Set(queries)];
}

// =====================================================
// GEOCODE MỘT TRẠM
// =====================================================

async function geocodeStation(station) {
  const queries = buildQueries(station);

  let bestReview = null;

  for (const query of queries) {
    const results = await searchLocation(query);

    // -----------------------------------------
    // Kiểm tra từng candidate
    // -----------------------------------------

    for (const result of results) {
      const evaluation = evaluateResult(station, result);

      console.log(`      Candidate: ${result.display_name}`);

      console.log(
        `      Score: ${evaluation.score.toFixed(2)} | ${evaluation.status}`,
      );

      if (evaluation.accepted && evaluation.status === "SAFE") {
        return {
          latitude: Number(result.lat),

          longitude: Number(result.lon),

          display_name: result.display_name,

          osm_type: result.osm_type,

          osm_id: result.osm_id,

          geocode_query: query,

          confidence: "HIGH",

          status: "SAFE",

          match_score: evaluation.score,

          geocode_success: true,
        };
      }

      // -----------------------------------------
      // Lưu REVIEW tốt nhất để dùng nếu
      // không tìm được SAFE
      // -----------------------------------------

      if (evaluation.accepted && evaluation.status === "REVIEW") {
        if (!bestReview || evaluation.score > bestReview.match_score) {
          bestReview = {
            latitude: Number(result.lat),

            longitude: Number(result.lon),

            display_name: result.display_name,

            osm_type: result.osm_type,

            osm_id: result.osm_id,

            geocode_query: query,

            confidence: "MEDIUM",

            status: "REVIEW",

            match_score: evaluation.score,

            geocode_success: true,
          };
        }
      }
    }

    await sleep(DELAY_MS);
  }

  // -----------------------------------------
  // Không SAFE nhưng có REVIEW
  // -----------------------------------------

  if (bestReview) {
    return bestReview;
  }

  // -----------------------------------------
  // Hoàn toàn không tìm được
  // -----------------------------------------

  return {
    latitude: null,
    longitude: null,

    display_name: null,

    osm_type: null,
    osm_id: null,

    geocode_query: null,

    confidence: "NONE",

    status: "MISSING",

    match_score: 0,

    geocode_success: false,
  };
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  try {
    console.log("");
    console.log("=================================");
    console.log("GEOCODE HSDC RAIN STATIONS V2");
    console.log("=================================");
    console.log("");

    // -----------------------------------------
    // Kiểm tra input
    // -----------------------------------------

    if (!fs.existsSync(INPUT_FILE)) {
      console.log("✗ Không tìm thấy:", INPUT_FILE);

      return;
    }

    // -----------------------------------------
    // Đọc JSON
    // -----------------------------------------

    const raw = fs.readFileSync(INPUT_FILE, "utf8");

    const json = JSON.parse(raw);

    const stations = Array.isArray(json) ? json : json.data;

    if (!Array.isArray(stations)) {
      throw new Error("Không tìm thấy mảng data");
    }

    console.log(`Có ${stations.length} trạm`);

    console.log("");

    const results = [];

    let safeCount = 0;
    let reviewCount = 0;
    let missingCount = 0;

    // =================================================
    // DUYỆT TRẠM
    // =================================================

    for (let i = 0; i < stations.length; i++) {
      const station = stations[i];

      console.log("");
      console.log(
        `[${i + 1}/${stations.length}] ` +
          `${station.station_id} | ` +
          `${station.name} - ` +
          `${station.address}`,
      );

      const geocode = await geocodeStation(station);

      const newStation = {
        ...station,

        latitude: geocode.latitude,

        longitude: geocode.longitude,

        status: geocode.status,

        confidence: geocode.confidence,

        match_score: geocode.match_score,

        geocode_success: geocode.geocode_success,

        geocode_display_name: geocode.display_name,

        geocode_query: geocode.geocode_query,

        osm_type: geocode.osm_type,

        osm_id: geocode.osm_id,
      };

      results.push(newStation);

      // -----------------------------------------
      // Đếm
      // -----------------------------------------

      if (geocode.status === "SAFE") {
        safeCount++;

        console.log(`   ✓ SAFE`);

        console.log(`   ${geocode.latitude}, ${geocode.longitude}`);
      } else if (geocode.status === "REVIEW") {
        reviewCount++;

        console.log(`   ⚠ REVIEW`);

        console.log(`   ${geocode.latitude}, ${geocode.longitude}`);

        console.log(`   ${geocode.display_name}`);
      } else {
        missingCount++;

        console.log("   ✗ MISSING");
      }

      console.log("");

      // -----------------------------------------
      // Lưu tạm sau MỖI trạm
      // tránh mất dữ liệu nếu script dừng
      // -----------------------------------------

      fs.writeFileSync(
        OUTPUT_FILE,

        JSON.stringify(
          {
            success: true,

            total: results.length,

            safe_count: safeCount,

            review_count: reviewCount,

            missing_count: missingCount,

            data: results,
          },

          null,
          2,
        ),

        "utf8",
      );

      await sleep(DELAY_MS);
    }

    // =================================================
    // KẾT QUẢ
    // =================================================

    console.log("");
    console.log("=================================");
    console.log("KẾT QUẢ");
    console.log("=================================");

    console.log("Tổng:", results.length);

    console.log("SAFE:", safeCount);

    console.log("REVIEW:", reviewCount);

    console.log("MISSING:", missingCount);

    console.log("");

    console.log("✓ Đã lưu:", OUTPUT_FILE);

    console.log("");

    console.table(
      results.map((station) => ({
        id: station.station_id,

        name: station.name,

        latitude: station.latitude,

        longitude: station.longitude,

        status: station.status,

        score: station.match_score,
      })),
    );
  } catch (error) {
    console.error("");
    console.error("✗ Lỗi:", error.message);
  }
}

main();
