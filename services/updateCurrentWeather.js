const pool = require("../db"); // sửa path theo project của bạn

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const BATCH_SIZE = 15;

// ================================================
// CHIA BATCH
// ================================================

function chunkArray(arr, size) {
  const result = [];

  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }

  return result;
}

// ================================================
// TỔNG MƯA N GIỜ
// ================================================

function sumLastHours(values, endIndex, hours) {
  let total = 0;

  const startIndex = Math.max(0, endIndex - hours + 1);

  for (let i = startIndex; i <= endIndex; i++) {
    total += Number(values[i] || 0);
  }

  return Number(total.toFixed(2));
}

// ================================================
// LẤY CURRENT HOUR
// ================================================

function getCurrentHourHanoi() {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",

    year: "numeric",
    month: "2-digit",
    day: "2-digit",

    hour: "2-digit",

    hour12: false,
  });

  const value = formatter.format(new Date());

  // Ví dụ:
  // 2026-09-24 14

  return value.replace(" ", "T") + ":00";
}

// ================================================
// UPSERT DATABASE
// ================================================

async function saveCurrentWeather(client, point, data) {
  const hourly = data.hourly;

  if (!hourly || !hourly.time || hourly.time.length === 0) {
    return;
  }

  const currentHour = getCurrentHourHanoi();

  // ============================================
  // TÌM GIỜ GẦN NHẤT <= CURRENT HOUR
  // ============================================

  let currentIndex = -1;

  for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i] <= currentHour) {
      currentIndex = i;
    } else {
      break;
    }
  }

  if (currentIndex === -1) {
    console.log("Không tìm thấy giờ hiện tại:", point.name);

    return;
  }

  const rain = hourly.rain || [];

  const precipitation = hourly.precipitation || [];

  const rain1h = sumLastHours(rain, currentIndex, 1);

  const rain3h = sumLastHours(rain, currentIndex, 3);

  const rain6h = sumLastHours(rain, currentIndex, 6);

  const rain12h = sumLastHours(rain, currentIndex, 12);

  const rain24h = sumLastHours(rain, currentIndex, 24);

  const sql = `
        INSERT INTO current_weather
        (
            flood_point_id,

            recorded_at,

            temperature_2m,
            relative_humidity_2m,

            precipitation_1h,

            rain_1h,
            rain_3h,
            rain_6h,
            rain_12h,
            rain_24h,

            soil_moisture_0_to_1cm,

            requested_latitude,
            requested_longitude,

            meteo_latitude,
            meteo_longitude,

            provider,

            updated_at
        )

        VALUES
        (
            $1, $2,

            $3, $4,

            $5,

            $6, $7, $8, $9, $10,

            $11,

            $12, $13,

            $14, $15,

            'OPEN_METEO',

            CURRENT_TIMESTAMP
        )

        ON CONFLICT (flood_point_id)

        DO UPDATE SET

            recorded_at =
                EXCLUDED.recorded_at,

            temperature_2m =
                EXCLUDED.temperature_2m,

            relative_humidity_2m =
                EXCLUDED.relative_humidity_2m,

            precipitation_1h =
                EXCLUDED.precipitation_1h,

            rain_1h =
                EXCLUDED.rain_1h,

            rain_3h =
                EXCLUDED.rain_3h,

            rain_6h =
                EXCLUDED.rain_6h,

            rain_12h =
                EXCLUDED.rain_12h,

            rain_24h =
                EXCLUDED.rain_24h,

            soil_moisture_0_to_1cm =
                EXCLUDED.soil_moisture_0_to_1cm,

            requested_latitude =
                EXCLUDED.requested_latitude,

            requested_longitude =
                EXCLUDED.requested_longitude,

            meteo_latitude =
                EXCLUDED.meteo_latitude,

            meteo_longitude =
                EXCLUDED.meteo_longitude,

            provider =
                EXCLUDED.provider,

            updated_at =
                CURRENT_TIMESTAMP
    `;

  await client.query(sql, [
    point.id,

    hourly.time[currentIndex],

    hourly.temperature_2m?.[currentIndex] ?? null,

    hourly.relative_humidity_2m?.[currentIndex] ?? null,

    precipitation[currentIndex] ?? null,

    rain1h,
    rain3h,
    rain6h,
    rain12h,
    rain24h,

    hourly.soil_moisture_0_to_1cm?.[currentIndex] ?? null,

    point.latitude,
    point.longitude,

    data.latitude,
    data.longitude,
  ]);

  console.log(
    `✓ ${point.id} | ${point.name}`,

    `rain1h=${rain1h}`,

    `rain3h=${rain3h}`,

    `rain24h=${rain24h}`,
  );
}

// ================================================
// MAIN UPDATE
// ================================================

async function updateCurrentWeather() {
  const client = await pool.connect();

  try {
    console.log("");
    console.log("============================");

    console.log("UPDATE CURRENT WEATHER");

    console.log(new Date().toISOString());

    console.log("============================");

    // ========================================
    // GET 44 FLOOD POINTS
    // ========================================

    const result = await client.query(`
                SELECT
                    id,
                    name,
                    latitude,
                    longitude

                FROM flood_points

                WHERE
                    latitude IS NOT NULL

                    AND longitude IS NOT NULL

                ORDER BY id
            `);

    const points = result.rows;

    console.log("Số điểm:", points.length);

    const batches = chunkArray(points, BATCH_SIZE);

    // ========================================
    // CALL OPEN-METEO
    // ========================================

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      console.log(`Batch ${batchIndex + 1}/${batches.length}`);

      const latitudes = batch.map((p) => p.latitude).join(",");

      const longitudes = batch.map((p) => p.longitude).join(",");

      const params = new URLSearchParams({
        latitude: latitudes,

        longitude: longitudes,

        hourly: [
          "temperature_2m",
          "relative_humidity_2m",
          "precipitation",
          "rain",
          "soil_moisture_0_to_1cm",
        ].join(","),

        timezone: "Asia/Ho_Chi_Minh",

        past_days: "1",

        forecast_days: "1",

        cell_selection: "nearest",
      });

      const url = `${OPEN_METEO_URL}?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Open-Meteo ${response.status}: ${errorText}`);
      }

      const json = await response.json();

      // Nhiều location
      // → array
      //
      // Một location
      // → object

      const locations = Array.isArray(json) ? json : [json];

      if (locations.length !== batch.length) {
        console.log("⚠ Số location không khớp batch");
      }

      for (let i = 0; i < locations.length && i < batch.length; i++) {
        await saveCurrentWeather(client, batch[i], locations[i]);
      }
    }

    console.log("✓ Hoàn thành current weather");
  } catch (error) {
    console.error("UPDATE WEATHER ERROR:", error);

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  updateCurrentWeather,
};
