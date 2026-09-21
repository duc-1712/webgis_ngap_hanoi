const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// =====================================================
// POSTGRESQL
// =====================================================

const pool = new Pool({
  host: "127.0.0.1",
  port: 5432,
  database: "webgis_ngap_hanoi",
  user: "postgres",
  password: "Duc_1712",
});

// =====================================================
// FILE JSON
// =====================================================

const JSON_FILE = path.join(__dirname, "hsdc-rain-stations-geocoded.json");

// =====================================================
// MAIN
// =====================================================

async function main() {
  try {
    console.log("");
    console.log("=================================");
    console.log("IMPORT HSDC RAIN STATIONS");
    console.log("=================================");

    const raw = fs.readFileSync(JSON_FILE, "utf8");

    const json = JSON.parse(raw);

    const stations = json.data;

    console.log("Số trạm:", stations.length);

    let inserted = 0;
    let updated = 0;

    for (const station of stations) {
      const check = await pool.query(
        `
        SELECT id
        FROM rain_stations
        WHERE hsdc_rain_id = $1
        `,
        [station.station_id],
      );

      // =============================================
      // INSERT
      // =============================================

      if (check.rows.length === 0) {
        await pool.query(
          `
          INSERT INTO rain_stations
          (
            hsdc_rain_id,
            name,
            address,

            latitude,
            longitude,

            geom,

            image_url,

            geocode_status,
            confidence,
            match_score,

            source
          )
          VALUES
          (
            $1,
            $2,
            $3,

            $4,
            $5,

            CASE
              WHEN $4::double precision IS NOT NULL
               AND $5::double precision IS NOT NULL
              THEN ST_SetSRID(
                ST_MakePoint(
                  $5::double precision,
                  $4::double precision
                ),
                4326
              )
              ELSE NULL
            END,

            $6,

            $7,
            $8,
            $9,

            'HSDC_RAIN'
          )
          `,
          [
            station.station_id,
            station.name,
            station.address,

            station.latitude,
            station.longitude,

            station.image_url,

            station.status,
            station.confidence,
            station.match_score,
          ],
        );

        inserted++;

        console.log(`+ Thêm ${station.station_id}: ${station.name}`);
      }

      // =============================================
      // UPDATE
      // =============================================
      else {
        await pool.query(
          `
          UPDATE rain_stations

          SET
            name = $1,
            address = $2,

            latitude = $3,
            longitude = $4,

            geom =
              CASE
                WHEN $3::double precision IS NOT NULL
                 AND $4::double precision IS NOT NULL
                THEN ST_SetSRID(
                  ST_MakePoint(
                    $4::double precision,
                    $3::double precision
                  ),
                  4326
                )
                ELSE NULL
              END,

            image_url = $5,

            geocode_status = $6,
            confidence = $7,
            match_score = $8,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE hsdc_rain_id = $9
          `,
          [
            station.name,
            station.address,

            station.latitude,
            station.longitude,

            station.image_url,

            station.status,
            station.confidence,
            station.match_score,

            station.station_id,
          ],
        );

        updated++;

        console.log(`↻ Update ${station.station_id}: ${station.name}`);
      }
    }

    console.log("");
    console.log("=================================");
    console.log("KẾT QUẢ");
    console.log("=================================");

    console.log("Inserted:", inserted);

    console.log("Updated:", updated);
  } catch (error) {
    console.error("Lỗi:", error.message);
  } finally {
    await pool.end();
  }
}

main();
