// const express = require("express");
// const path = require("path");

// const app = express();

// const PORT = 3000;

// // ===============================
// // CẤU HÌNH
// // ===============================

// const HSDC_FLOOD_API = "https://thoatnuochanoi.vn/ungngap/api/flood/getflood";

// // ===============================
// // CHO PHÉP FRONTEND
// // ===============================

// app.use(express.json());

// // ===============================
// // PHỤC VỤ HTML / CSS / JS
// // ===============================

// app.use(express.static(path.join(__dirname, "public")));

// // ===============================
// // API LẤY ĐIỂM NGẬP HSDC
// // ===============================

// app.get("/api/flood", async (req, res) => {
//   try {
//     console.log("Đang gọi HSDC...");

//     const response = await fetch(HSDC_FLOOD_API);

//     if (!response.ok) {
//       throw new Error(`HSDC trả về HTTP ${response.status}`);
//     }

//     const data = await response.json();

//     console.log("Đã nhận dữ liệu HSDC:", data.Content?.length || 0, "điểm");

//     res.json(data);
//   } catch (error) {
//     console.error("Lỗi HSDC:", error);

//     res.status(500).json({
//       success: false,
//       message: "Không thể lấy dữ liệu từ HSDC",
//       error: error.message,
//     });
//   }
// });

// // ===============================
// // API LẤY MƯA OPEN-METEO
// // ===============================

// app.get("/api/rain", async (req, res) => {
//   try {
//     const lat = req.query.lat;
//     const lon = req.query.lon;

//     if (!lat || !lon) {
//       return res.status(400).json({
//         success: false,
//         message: "Thiếu latitude hoặc longitude",
//       });
//     }

//     const url =
//       `https://api.open-meteo.com/v1/forecast` +
//       `?latitude=${encodeURIComponent(lat)}` +
//       `&longitude=${encodeURIComponent(lon)}` +
//       `&current=precipitation,rain` +
//       `&timezone=Asia%2FBangkok`;

//     console.log("Open-Meteo:", lat, lon);

//     const response = await fetch(url);

//     if (!response.ok) {
//       throw new Error(`Open-Meteo HTTP ${response.status}`);
//     }

//     const data = await response.json();

//     res.json(data);
//   } catch (error) {
//     console.error("Lỗi Open-Meteo:", error);

//     res.status(500).json({
//       success: false,
//       message: "Không thể lấy dữ liệu mưa",
//       error: error.message,
//     });
//   }
// });

// // ===============================
// // CHẠY SERVER
// // ===============================

// app.listen(PORT, () => {
//   console.log("");
//   console.log("=================================");
//   console.log(" WEBGIS NGẬP LỤT HÀ NỘI");
//   console.log("=================================");
//   console.log(`Server: http://localhost:${PORT}`);
//   console.log("");
// });
//
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const express = require("express");
const path = require("path");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();
const PORT = 3000;

// ===============================
// CẤU HÌNH POSTGRESQL
// ===============================

const pool = new Pool({
  host: "127.0.0.1",
  port: 5432,
  database: "webgis_ngap_hanoi",
  user: "postgres",
  password: "Duc_1712",
});

// ===============================
// CẤU HÌNH API
// ===============================

const HSDC_FLOOD_API = "https://thoatnuochanoi.vn/ungngap/api/flood/getflood";

const OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast";

// ===============================
// MIDDLEWARE
// ===============================

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// 1. TEST KẾT NỐI POSTGRESQL
// =====================================================

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.json({
      success: true,
      message: "Kết nối PostgreSQL thành công",
      time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Lỗi PostgreSQL:", error.message);

    res.status(500).json({
      success: false,
      message: "Không kết nối được PostgreSQL",
      error: error.message,
    });
  }
});

// =====================================================
// 2. API LẤY ĐIỂM NGẬP HSDC
// =====================================================

app.get("/api/flood", async (req, res) => {
  try {
    console.log("Đang gọi HSDC...");

    const response = await axios.get(HSDC_FLOOD_API, {
      timeout: 30000,
    });

    console.log(
      "Đã nhận dữ liệu HSDC:",
      response.data?.Content?.length || 0,
      "điểm",
    );

    res.json(response.data);
  } catch (error) {
    console.error("Lỗi HSDC:", error.message);

    res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu từ HSDC",
      error: error.message,
    });
  }
});

// =====================================================
// 3. API LẤY MƯA OPEN-METEO
// =====================================================

app.get("/api/rain", async (req, res) => {
  try {
    const lat = req.query.lat;
    const lon = req.query.lon;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: "Thiếu latitude hoặc longitude",
      });
    }

    console.log(`Đang lấy dữ liệu mưa Open-Meteo: ${lat}, ${lon}`);

    const response = await axios.get(OPEN_METEO_API, {
      params: {
        latitude: point.latitude,
        longitude: point.longitude,

        current: "precipitation,rain",
        hourly: "precipitation,rain",

        timezone: "Asia/Bangkok",

        cell_selection: "nearest",
      },

      timeout: 30000,
    });

    res.json(response.data);
  } catch (error) {
    console.error("Lỗi Open-Meteo:", error.message);

    res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu mưa từ Open-Meteo",
      error: error.message,
    });
  }
});

// =====================================================
// 4. ĐỒNG BỘ ĐIỂM NGẬP HSDC VÀO DATABASE
// =====================================================

app.get("/api/sync-flood-points", async (req, res) => {
  try {
    console.log("");
    console.log("=================================");
    console.log("ĐỒNG BỘ ĐIỂM NGẬP HSDC");
    console.log("=================================");

    // ---------------------------------------------
    // Gọi API HSDC
    // ---------------------------------------------

    const response = await axios.get(HSDC_FLOOD_API, {
      timeout: 30000,
    });

    const points = response.data?.Content || [];

    console.log("HSDC trả về:", points.length, "điểm");

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // ---------------------------------------------
    // Duyệt từng điểm
    // ---------------------------------------------

    for (const point of points) {
      const hsdcId = Number(point.TramId);
      const name = point.TenTram;

      const lat = Number(point.Lat);
      const lng = Number(point.Lng);

      // -------------------------------------------
      // Kiểm tra dữ liệu
      // -------------------------------------------

      if (
        !Number.isFinite(hsdcId) ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat === 0 ||
        lng === 0
      ) {
        console.log("Bỏ qua điểm không hợp lệ:", point);

        skipped++;

        continue;
      }

      // -------------------------------------------
      // Kiểm tra điểm đã tồn tại
      // -------------------------------------------

      const check = await pool.query(
        `
        SELECT id
        FROM flood_points
        WHERE hsdc_id = $1
        `,
        [hsdcId],
      );

      // -------------------------------------------
      // Nếu chưa có → INSERT
      // -------------------------------------------

      if (check.rows.length === 0) {
        await pool.query(
          `
          INSERT INTO flood_points
          (
            hsdc_id,
            name,
            latitude,
            longitude,
            geom,
            source,
            status
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            ST_SetSRID(
              ST_MakePoint($4, $3),
              4326
            ),
            'HSDC',
            'Đang ngập'
          )
          `,
          [hsdcId, name, lat, lng],
        );

        inserted++;

        console.log(`+ Thêm: ${name}`);
      }

      // -------------------------------------------
      // Nếu đã có → UPDATE
      // -------------------------------------------
      else {
        await pool.query(
          `
          UPDATE flood_points
          SET
            name = $1,
            latitude = $2,
            longitude = $3,
            geom = ST_SetSRID(
              ST_MakePoint($3, $2),
              4326
            ),
            updated_at = CURRENT_TIMESTAMP
          WHERE hsdc_id = $4
          `,
          [name, lat, lng, hsdcId],
        );

        updated++;

        console.log(`↻ Cập nhật: ${name}`);
      }
    }

    console.log("");
    console.log("KẾT QUẢ ĐỒNG BỘ");
    console.log("-----------------------------");
    console.log("Thêm mới :", inserted);
    console.log("Cập nhật :", updated);
    console.log("Bỏ qua   :", skipped);
    console.log("-----------------------------");

    res.json({
      success: true,
      message: "Đồng bộ điểm ngập thành công",
      total_hsdc: points.length,
      inserted: inserted,
      updated: updated,
      skipped: skipped,
    });
  } catch (error) {
    console.error("Lỗi đồng bộ điểm ngập:", error.message);

    res.status(500).json({
      success: false,
      message: "Không thể đồng bộ điểm ngập HSDC",
      error: error.message,
    });
  }
});

// =====================================================
// 5. LẤY MƯA OPEN-METEO VÀ LƯU DATABASE
// =====================================================

app.get("/api/sync-weather", async (req, res) => {
  try {
    console.log("");
    console.log("=================================");
    console.log("ĐỒNG BỘ DỮ LIỆU MƯA");
    console.log("=================================");

    // ---------------------------------------------
    // Lấy toàn bộ điểm ngập trong database
    // ---------------------------------------------

    const result = await pool.query(
      `
      SELECT
        id,
        hsdc_id,
        name,
        latitude,
        longitude
      FROM flood_points
      ORDER BY id
      `,
    );

    const floodPoints = result.rows;

    console.log("Có", floodPoints.length, "điểm ngập trong database");

    let successCount = 0;
    let errorCount = 0;

    // ---------------------------------------------
    // Duyệt từng điểm
    // ---------------------------------------------

    for (const point of floodPoints) {
      try {
        console.log(`Đang lấy mưa: ${point.name}`);

        // -----------------------------------------
        // Gọi Open-Meteo
        // -----------------------------------------

        const response = await axios.get(OPEN_METEO_API, {
          params: {
            latitude: point.latitude,
            longitude: point.longitude,

            current: "precipitation,rain",

            hourly: "precipitation,rain",

            timezone: "Asia/Bangkok",
          },

          timeout: 30000,
        });

        const data = response.data;

        // -----------------------------------------
        // Tọa độ gốc của trạm HSDC
        // -----------------------------------------

        const requestedLatitude = Number(point.latitude);
        const requestedLongitude = Number(point.longitude);

        // -----------------------------------------
        // Tọa độ grid thực tế Open-Meteo sử dụng
        // -----------------------------------------

        const meteoLatitude = Number(data.latitude);
        const meteoLongitude = Number(data.longitude);

        // -----------------------------------------
        // Lấy thời gian và dữ liệu mưa
        // -----------------------------------------

        const recordedAt = data.current?.time;

        const precipitation = Number(data.current?.precipitation ?? 0);

        const rain = Number(data.current?.rain ?? 0);

        if (!recordedAt) {
          console.log(`Không có thời gian dữ liệu: ${point.name}`);

          errorCount++;

          continue;
        }

        // -----------------------------------------
        // Debug để thấy có bị lệch tọa độ không
        // -----------------------------------------

        console.log(`
${point.name}
HSDC       : ${requestedLatitude}, ${requestedLongitude}
Open-Meteo : ${meteoLatitude}, ${meteoLongitude}
Mưa        : ${rain} mm
`);

        // -----------------------------------------
        // Lưu weather_data
        // -----------------------------------------

        await pool.query(
          `
  INSERT INTO weather_data
  (
    flood_point_id,
    requested_latitude,
    requested_longitude,
    meteo_latitude,
    meteo_longitude,
    recorded_at,
    precipitation,
    rain,
    provider
  )
  VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    'OPEN_METEO'
  )

  ON CONFLICT (flood_point_id, recorded_at)

  DO UPDATE SET
    requested_latitude = EXCLUDED.requested_latitude,
    requested_longitude = EXCLUDED.requested_longitude,
    meteo_latitude = EXCLUDED.meteo_latitude,
    meteo_longitude = EXCLUDED.meteo_longitude,
    precipitation = EXCLUDED.precipitation,
    rain = EXCLUDED.rain,
    provider = 'OPEN_METEO'
  `,
          [
            point.id,
            requestedLatitude,
            requestedLongitude,
            meteoLatitude,
            meteoLongitude,
            recordedAt,
            precipitation,
            rain,
          ],
        );
        successCount++;

        console.log(
          `✓ ${point.name} | precipitation=${precipitation} mm | rain=${rain} mm`,
        );
      } catch (error) {
        errorCount++;

        console.error(`✗ Lỗi điểm ${point.name}:`, error.message);
      }
    }

    console.log("");
    console.log("KẾT QUẢ ĐỒNG BỘ MƯA");
    console.log("-----------------------------");
    console.log("Thành công :", successCount);
    console.log("Lỗi        :", errorCount);
    console.log("-----------------------------");

    res.json({
      success: true,
      message: "Đồng bộ dữ liệu mưa hoàn tất",
      total_points: floodPoints.length,
      success_count: successCount,
      error_count: errorCount,
    });
  } catch (error) {
    console.error("Lỗi đồng bộ dữ liệu mưa:", error.message);

    res.status(500).json({
      success: false,
      message: "Không thể đồng bộ dữ liệu mưa",
      error: error.message,
    });
  }
});

// =====================================================
// 6. XEM DỮ LIỆU MƯA ĐÃ LƯU
// =====================================================

app.get("/api/weather-data", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        w.id,
        w.flood_point_id,
        f.hsdc_id,
        f.name,
        f.latitude,
        f.longitude,
        w.recorded_at,
        w.precipitation,
        w.rain
      FROM weather_data w
      JOIN flood_points f
        ON f.id = w.flood_point_id
      ORDER BY w.recorded_at DESC
      LIMIT 100
      `,
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Lỗi lấy weather_data:", error.message);

    res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu weather_data",
      error: error.message,
    });
  }
});

// =====================================================
// 7. CHẠY SERVER
// =====================================================
// =====================================================
// API: LẤY DANH SÁCH TRẠM MƯA HSDC
// =====================================================

app.get("/api/rain-stations", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        hsdc_rain_id,
        name,
        address,
        latitude,
        longitude,
        image_url,
        geocode_status,
        confidence,
        match_score,
        source,
        created_at,
        updated_at
      FROM rain_stations
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
      ORDER BY hsdc_rain_id ASC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách trạm mưa:", error);

    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách trạm mưa",
      error: error.message,
    });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("=================================");
  console.log(" WEBGIS NGẬP LỤT HÀ NỘI");
  console.log("=================================");
  console.log(`Server chạy tại: http://localhost:${PORT}`);
  console.log("");
});

// =====================================================
// 8. KIỂM TRA DATABASE KHI KHỞI ĐỘNG
// =====================================================

pool
  .query("SELECT NOW()")
  .then(() => {
    console.log("✓ PostgreSQL: Kết nối thành công");
  })
  .catch((error) => {
    console.error("✗ PostgreSQL: Không kết nối được");

    console.error(error.message);
  });
