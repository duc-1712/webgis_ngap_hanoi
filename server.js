// =====================================================
// WEBGIS QUẢN LÝ NGẬP LỤT HÀ NỘI
// SERVER.JS
// =====================================================

// =====================================================
// 1. IMPORT
// =====================================================

const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const multer = require("multer");

const { Pool } = require("pg");

const { updateCurrentWeather } = require("./services/updateCurrentWeather");
// =====================================================
// 2. APP
// =====================================================

const app = express();

const PORT = 3000;

// =====================================================
// 3. POSTGRESQL
// =====================================================

const pool = new Pool({
  host: "127.0.0.1",

  port: 5432,

  database: "webgis_ngap_hanoi",

  user: "postgres",

  password: "Duc_1712",
  // Thay bằng mật khẩu PostgreSQL của bạn
  // password: process.env.DB_PASSWORD || "MAT_KHAU_POSTGRES_CUA_BAN",
});

// =====================================================
// 4. API URL
// =====================================================

const HSDC_FLOOD_API = "https://thoatnuochanoi.vn/ungngap/api/flood/getflood";

const OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast";

// =====================================================
// 5. MIDDLEWARE
// =====================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.get("/api/update-current-weather", async (req, res) => {
  try {
    await updateCurrentWeather();

    res.json({
      success: true,
      message: "Đã cập nhật current weather",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
// frontend / ảnh upload
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// 6. CẤU HÌNH UPLOAD ẢNH
// =====================================================

const uploadDir = path.join(__dirname, "public", "uploads", "flood-reports");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);

    const fileName = `flood_${Date.now()}_${Math.round(
      Math.random() * 100000,
    )}${ext}`;

    cb(null, fileName);
  },
});

const upload = multer({
  storage,

  limits: {
    // tối đa 5 MB
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: function (req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"));
    }
  },
});

// =====================================================
// 7. TEST DATABASE
// =====================================================

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query(
      `
          SELECT
            NOW()
            AS current_time
          `,
    );

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
// 8. LẤY DANH SÁCH ĐIỂM HSDC
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

      message: "Không thể lấy dữ liệu HSDC",

      error: error.message,
    });
  }
});

// =====================================================
// 9. OPEN-METEO THEO TỌA ĐỘ
// =====================================================

app.get("/api/rain", async (req, res) => {
  try {
    const lat = Number(req.query.lat);

    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        success: false,

        message: "Latitude hoặc longitude không hợp lệ",
      });
    }

    const response = await axios.get(OPEN_METEO_API, {
      params: {
        latitude: lat,

        longitude: lon,

        current: "temperature_2m,relative_humidity_2m,precipitation,rain",

        hourly: "precipitation,rain",

        timezone: "Asia/Ho_Chi_Minh",

        cell_selection: "nearest",
      },

      timeout: 30000,
    });

    res.json(response.data);
  } catch (error) {
    console.error("Lỗi Open-Meteo:", error.message);

    res.status(500).json({
      success: false,

      message: "Không thể lấy dữ liệu Open-Meteo",

      error: error.message,
    });
  }
});

// =====================================================
// 10. ĐỒNG BỘ HSDC VÀO flood_points
// =====================================================

app.get("/api/sync-flood-points", async (req, res) => {
  try {
    console.log("");

    console.log("=================================");

    console.log("ĐỒNG BỘ ĐIỂM HSDC");

    console.log("=================================");

    const response = await axios.get(HSDC_FLOOD_API, {
      timeout: 30000,
    });

    const points = response.data?.Content || [];

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const point of points) {
      const hsdcId = Number(point.TramId);

      const name = point.TenTram;

      const lat = Number(point.Lat);

      const lng = Number(point.Lng);

      if (
        !Number.isFinite(hsdcId) ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat === 0 ||
        lng === 0
      ) {
        skipped++;

        continue;
      }

      const check = await pool.query(
        `
            SELECT id

            FROM flood_points

            WHERE hsdc_id = $1
            `,
        [hsdcId],
      );

      if (check.rows.length === 0) {
        await pool.query(
          `
            INSERT INTO
              flood_points
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
                ST_MakePoint(
                  $4,
                  $3
                ),
                4326
              ),

              'HSDC',

              'Tham chiếu'
            )
            `,
          [hsdcId, name, lat, lng],
        );

        inserted++;
      } else {
        await pool.query(
          `
            UPDATE
              flood_points

            SET
              name = $1,

              latitude = $2,

              longitude = $3,

              geom =
                ST_SetSRID(
                  ST_MakePoint(
                    $3,
                    $2
                  ),
                  4326
                ),

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              hsdc_id = $4
            `,
          [name, lat, lng, hsdcId],
        );

        updated++;
      }
    }

    res.json({
      success: true,

      message: "Đồng bộ điểm HSDC thành công",

      total_hsdc: points.length,

      inserted,

      updated,

      skipped,
    });
  } catch (error) {
    console.error("Sync flood:", error.message);

    res.status(500).json({
      success: false,

      message: "Không thể đồng bộ HSDC",

      error: error.message,
    });
  }
});

// =====================================================
// 11. ĐỒNG BỘ OPEN-METEO VÀO weather_data
// =====================================================

app.get("/api/sync-weather", async (req, res) => {
  try {
    console.log("");

    console.log("=================================");

    console.log("ĐỒNG BỘ DỮ LIỆU THỜI TIẾT");

    console.log("=================================");

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

    let successCount = 0;

    let errorCount = 0;

    for (const point of floodPoints) {
      try {
        console.log(`Đang lấy: ${point.name}`);

        const response = await axios.get(OPEN_METEO_API, {
          params: {
            latitude: point.latitude,

            longitude: point.longitude,

            current: "precipitation,rain",

            hourly: "precipitation,rain",

            timezone: "Asia/Ho_Chi_Minh",

            cell_selection: "nearest",
          },

          timeout: 30000,
        });

        const data = response.data;

        const recordedAt = data.current?.time;

        if (!recordedAt) {
          errorCount++;

          continue;
        }

        const requestedLatitude = Number(point.latitude);

        const requestedLongitude = Number(point.longitude);

        const meteoLatitude = Number(data.latitude);

        const meteoLongitude = Number(data.longitude);

        const precipitation = Number(data.current?.precipitation ?? 0);

        const rain = Number(data.current?.rain ?? 0);

        await pool.query(
          `
            INSERT INTO
              weather_data
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

            ON CONFLICT
            (
              flood_point_id,
              recorded_at
            )

            DO UPDATE SET

              requested_latitude =
                EXCLUDED.requested_latitude,

              requested_longitude =
                EXCLUDED.requested_longitude,

              meteo_latitude =
                EXCLUDED.meteo_latitude,

              meteo_longitude =
                EXCLUDED.meteo_longitude,

              precipitation =
                EXCLUDED.precipitation,

              rain =
                EXCLUDED.rain,

              provider =
                'OPEN_METEO'
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

        console.log(`✓ ${point.name} | rain=${rain}mm`);
      } catch (error) {
        errorCount++;

        console.error(`✗ ${point.name}:`, error.message);
      }
    }

    res.json({
      success: true,

      total_points: floodPoints.length,

      success_count: successCount,

      error_count: errorCount,
    });
  } catch (error) {
    console.error("Sync weather:", error.message);

    res.status(500).json({
      success: false,

      message: "Không thể đồng bộ weather",

      error: error.message,
    });
  }
});

// =====================================================
// 12. XEM WEATHER_DATA
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

          FROM
            weather_data w

          JOIN
            flood_points f

          ON
            f.id =
            w.flood_point_id

          ORDER BY
            w.recorded_at
            DESC

          LIMIT 100
          `,
    );

    res.json({
      success: true,

      count: result.rows.length,

      data: result.rows,
    });
  } catch (error) {
    console.error("weather-data:", error.message);

    res.status(500).json({
      success: false,

      message: "Không lấy được weather_data",

      error: error.message,
    });
  }
});

// =====================================================
// 13. LẤY TRẠM MƯA HSDC
// =====================================================

app.get("/api/rain-stations", async (req, res) => {
  try {
    const result = await pool.query(
      `
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

          FROM
            rain_stations

          WHERE
            latitude IS NOT NULL

            AND

            longitude IS NOT NULL

          ORDER BY
            hsdc_rain_id ASC
          `,
    );

    res.json({
      success: true,

      count: result.rows.length,

      data: result.rows,
    });
  } catch (error) {
    console.error("rain-stations:", error.message);

    res.status(500).json({
      success: false,

      message: "Không thể lấy trạm mưa",

      error: error.message,
    });
  }
});

// =====================================================
// 14. LẤY BÁO CÁO NGẬP USER
// =====================================================

app.get("/api/flood-reports", async (req, res) => {
  try {
    const result = await pool.query(
      `
          SELECT
            id,

            latitude,
            longitude,

            location_accuracy,
            location_source,

            address,

            flood_level,

            traffic_status,

            description,

            image_url,

            reported_at,

            status,

            trust_score,

            verified_at

          FROM
            user_flood_reports

          WHERE
            status IN (
              'PENDING',
              'VERIFIED'
            )

          ORDER BY
            reported_at DESC

          LIMIT 500
          `,
    );

    res.json({
      success: true,

      count: result.rows.length,

      data: result.rows,
    });
  } catch (error) {
    console.error("GET flood-reports:", error.message);

    res.status(500).json({
      success: false,

      message: "Không thể lấy báo cáo",

      error: error.message,
    });
  }
});

// =====================================================
// 15. USER GỬI BÁO CÁO NGẬP
// =====================================================

app.post(
  "/api/flood-reports",

  upload.single("image"),

  async (req, res) => {
    try {
      const {
        latitude,

        longitude,

        location_accuracy,

        location_source,

        address,

        flood_level,

        traffic_status,

        description,
      } = req.body;

      const lat = Number(latitude);

      const lng = Number(longitude);

      const accuracy = location_accuracy ? Number(location_accuracy) : null;

      // =========================================
      // VALIDATE
      // =========================================

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({
          success: false,

          message: "Vị trí không hợp lệ",
        });
      }

      // giới hạn khu vực hợp lý
      // tránh tọa độ hoàn toàn sai

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,

          message: "Tọa độ không hợp lệ",
        });
      }

      const validFloodLevels = ["LIGHT", "MEDIUM", "HEAVY", "BLOCKED"];

      if (!validFloodLevels.includes(flood_level)) {
        return res.status(400).json({
          success: false,

          message: "Mức độ ngập không hợp lệ",
        });
      }

      // =========================================
      // TRUST SCORE
      // =========================================

      let trustScore = 0;

      // GPS

      if (location_source === "GPS") {
        trustScore += 15;

        if (accuracy !== null && accuracy <= 30) {
          trustScore += 15;
        } else if (accuracy !== null && accuracy <= 100) {
          trustScore += 8;
        }
      }

      // Có ảnh

      if (req.file) {
        trustScore += 20;
      }

      // =========================================
      // BÁO CÁO GẦN
      // 300m / 30 phút
      // =========================================

      const nearbyResult = await pool.query(
        `
          SELECT
            COUNT(*)::int
            AS count

          FROM
            user_flood_reports

          WHERE
            reported_at >=
              CURRENT_TIMESTAMP
              - INTERVAL '30 minutes'

            AND

            status IN (
              'PENDING',
              'VERIFIED'
            )

            AND

            geom IS NOT NULL

            AND

            ST_DWithin(
              geom::geography,

              ST_SetSRID(
                ST_MakePoint(
                  $1,
                  $2
                ),
                4326
              )::geography,

              300
            )
          `,
        [lng, lat],
      );

      const nearbyCount = nearbyResult.rows[0]?.count || 0;

      if (nearbyCount >= 3) {
        trustScore += 30;
      } else if (nearbyCount === 2) {
        trustScore += 20;
      } else if (nearbyCount === 1) {
        trustScore += 10;
      }

      trustScore = Math.min(trustScore, 100);

      // =========================================
      // IMAGE URL
      // =========================================

      const imageUrl = req.file
        ? `/uploads/flood-reports/${req.file.filename}`
        : null;

      // =========================================
      // INSERT
      // =========================================

      const result = await pool.query(
        `
          INSERT INTO
            user_flood_reports
          (
            latitude,

            longitude,

            geom,

            location_accuracy,

            location_source,

            address,

            flood_level,

            traffic_status,

            description,

            image_url,

            trust_score,

            status
          )

          VALUES
          (
            $1,

            $2,

            ST_SetSRID(
              ST_MakePoint(
                $2,
                $1
              ),
              4326
            ),

            $3,

            $4,

            $5,

            $6,

            $7,

            $8,

            $9,

            $10,

            'PENDING'
          )

          RETURNING *
          `,
        [
          lat,

          lng,

          accuracy,

          location_source || "MAP",

          address || null,

          flood_level,

          traffic_status || null,

          description || null,

          imageUrl,

          trustScore,
        ],
      );

      res.status(201).json({
        success: true,

        message: "Đã gửi báo cáo ngập",

        data: result.rows[0],
      });
    } catch (error) {
      console.error("POST flood report:", error);

      res.status(500).json({
        success: false,

        message: "Không thể lưu báo cáo",

        error: error.message,
      });
    }
  },
);

// =====================================================
// 16. MULTER ERROR
// =====================================================

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,

      message:
        error.code === "LIMIT_FILE_SIZE" ? "Ảnh vượt quá 5 MB" : error.message,
    });
  }

  if (error && error.message === "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP") {
    return res.status(400).json({
      success: false,

      message: error.message,
    });
  }

  next(error);
});

// =====================================================
// 17. TEST DATABASE KHI START
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

// =====================================================
// 18. START SERVER
// PHẢI ĐỂ CUỐI FILE
// =====================================================

app.listen(PORT, "127.0.0.1", () => {
  console.log("");

  console.log("=================================");

  console.log(" FLOODGIS HÀ NỘI");

  console.log("=================================");

  console.log(`Server: http://localhost:${PORT}`);

  console.log("");
});
