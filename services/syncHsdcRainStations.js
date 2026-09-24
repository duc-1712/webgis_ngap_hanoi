const axios = require("axios");
const cheerio = require("cheerio");
const pool = require("../db");

const HSDC_RAIN_URL =
  "https://thoatnuochanoi.vn/rain/Contains/ajax/thuytri.ashx";

const GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode/search";

// Khu vực nghiên cứu Hà Nội
const HANOI_BBOX = {
  west: 105.25,
  south: 20.55,
  east: 106.05,
  north: 21.4,
};

// =====================================================
// UTILS
// =====================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function insideHanoi(lat, lon) {
  return (
    lat >= HANOI_BBOX.south &&
    lat <= HANOI_BBOX.north &&
    lon >= HANOI_BBOX.west &&
    lon <= HANOI_BBOX.east
  );
}

function classifyConfidence(result) {
  if (!result) {
    return {
      status: "FAILED",
      confidence: "LOW",
    };
  }

  return {
    status: "REVIEW",
    confidence: "MEDIUM",
  };
}

// =====================================================
// LẤY 48 TRẠM TỪ HSDC
// =====================================================

async function fetchHsdcStations() {
  const response = await axios.get(HSDC_RAIN_URL, {
    params: {
      type: "getMua",
    },

    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

      Referer: "https://thoatnuochanoi.vn/rain/",
    },

    timeout: 15000,
  });

  const $ = cheerio.load(response.data);

  const stations = [];

  $(".border_item[id^='tram_']").each((index, element) => {
    const container = $(element);

    const elementId = container.attr("id") || "";

    const match = elementId.match(/^tram_(\d+)$/);

    if (!match) {
      return;
    }

    const hsdcRainId = Number(match[1]);

    const name = cleanText(container.find(".tentram2").first().text());

    let address = cleanText(container.find(".diachi2").first().text());

    address = address.replace(/^\(/, "").replace(/\)$/, "").trim();

    // Dùng URL ổn định.
    // Query ?timestamp sẽ thêm ở frontend
    // để chống cache.
    const imageUrl = `https://thoatnuochanoi.vn/rain/images/${hsdcRainId}.png`;

    stations.push({
      hsdc_rain_id: hsdcRainId,

      name,

      address,

      image_url: imageUrl,
    });
  });

  return stations;
}

// =====================================================
// GEOAPIFY
// =====================================================

async function geocodeStation(station) {
  const queries = [
    `${station.address}, ${station.name}, Hà Nội, Việt Nam`,
    `${station.address}, Hà Nội, Việt Nam`,
    `${station.name}, Hà Nội, Việt Nam`,
  ];

  for (const query of queries) {
    try {
      const response = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: query,
            format: "jsonv2",
            limit: 5,
            countrycodes: "vn",
            viewbox: "105.25,21.40,106.05,20.55",
            bounded: 1,
            addressdetails: 1,
          },

          headers: {
            "User-Agent": "WebGIS-Ngap-Ha-Noi/1.0 (student thesis project)",
          },

          timeout: 15000,
        },
      );

      const results = response.data || [];

      for (const item of results) {
        const lat = Number(item.lat);

        const lon = Number(item.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          continue;
        }

        if (lat < 20.55 || lat > 21.4 || lon < 105.25 || lon > 106.05) {
          continue;
        }

        return {
          latitude: lat,
          longitude: lon,

          score: Number(item.importance || 0),

          formatted: item.display_name,

          result_type: item.type,
        };
      }
    } catch (error) {
      console.log("Nominatim lỗi:", station.name, error.message);
    }

    // QUAN TRỌNG:
    // public Nominatim tối đa ~1 request/giây
    await sleep(1100);
  }

  return null;
}

// =====================================================
// SYNC DATABASE
// =====================================================

async function syncHsdcRainStations() {
  const client = await pool.connect();

  const summary = {
    hsdc_total: 0,
    inserted: 0,
    updated: 0,
    geocoded: 0,
    review: 0,
    failed: 0,
  };

  try {
    console.log("");
    console.log("======================================");

    console.log("SYNC HSDC RAIN STATIONS");

    console.log("======================================");

    const stations = await fetchHsdcStations();

    summary.hsdc_total = stations.length;

    console.log("HSDC stations:", stations.length);

    for (const station of stations) {
      console.log("");
      console.log(`${station.hsdc_rain_id} | ${station.name}`);

      // ======================================
      // KIỂM TRA TRẠM ĐÃ CÓ TRONG DB CHƯA
      // ======================================

      const existingResult = await client.query(
        `
                    SELECT
                        id,
                        latitude,
                        longitude,
                        geocode_status,
                        confidence,
                        match_score

                    FROM rain_stations

                    WHERE hsdc_rain_id = $1

                    LIMIT 1
                    `,
        [station.hsdc_rain_id],
      );

      const existing = existingResult.rows[0] || null;

      let latitude = existing?.latitude ?? null;

      let longitude = existing?.longitude ?? null;

      let geocodeStatus = existing?.geocode_status || null;

      let confidence = existing?.confidence || null;

      let matchScore = existing?.match_score ?? null;

      // ======================================
      // CHỈ GEOCODE NẾU CHƯA CÓ TỌA ĐỘ
      // ======================================

      if (latitude === null || longitude === null) {
        console.log("  → Chưa có tọa độ, geocoding...");

        const geo = await geocodeStation(station);

        if (geo) {
          latitude = geo.latitude;

          longitude = geo.longitude;

          matchScore = geo.score;

          const classification = classifyConfidence(geo);

          geocodeStatus = classification.status;

          confidence = classification.confidence;

          summary.geocoded++;

          if (geocodeStatus === "REVIEW") {
            summary.review++;
          }

          console.log(
            "  ✓",
            latitude,
            longitude,
            `score=${geo.score.toFixed(2)}`,
            geocodeStatus,
          );
        } else {
          geocodeStatus = "FAILED";

          confidence = "LOW";

          summary.failed++;

          console.log("  ✗ Không geocode được");
        }
      } else {
        console.log("  ✓ Giữ tọa độ DB:", latitude, longitude);
      }

      // ======================================
      // UPSERT
      // ======================================

      await client.query(
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

                    source,

                    updated_at
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

                    'HSDC_RAIN',

                    CURRENT_TIMESTAMP
                )

                ON CONFLICT (hsdc_rain_id)

                DO UPDATE SET

                    name =
                        EXCLUDED.name,

                    address =
                        EXCLUDED.address,

                    image_url =
                        EXCLUDED.image_url,

                    source =
                        'HSDC_RAIN',

                    -- Không ghi đè tọa độ cũ
                    latitude =
                        COALESCE(
                            rain_stations.latitude,
                            EXCLUDED.latitude
                        ),

                    longitude =
                        COALESCE(
                            rain_stations.longitude,
                            EXCLUDED.longitude
                        ),

                    geom =
                        COALESCE(
                            rain_stations.geom,
                            EXCLUDED.geom
                        ),

                    geocode_status =
                        CASE
                            WHEN rain_stations.latitude IS NULL
                              OR rain_stations.longitude IS NULL

                            THEN EXCLUDED.geocode_status

                            ELSE rain_stations.geocode_status
                        END,

                    confidence =
                        CASE
                            WHEN rain_stations.latitude IS NULL
                              OR rain_stations.longitude IS NULL

                            THEN EXCLUDED.confidence

                            ELSE rain_stations.confidence
                        END,

                    match_score =
                        CASE
                            WHEN rain_stations.latitude IS NULL
                              OR rain_stations.longitude IS NULL

                            THEN EXCLUDED.match_score

                            ELSE rain_stations.match_score
                        END,

                    updated_at =
                        CURRENT_TIMESTAMP
                `,
        [
          station.hsdc_rain_id,

          station.name,

          station.address,

          latitude,

          longitude,

          station.image_url,

          geocodeStatus,

          confidence,

          matchScore,
        ],
      );

      if (existing) {
        summary.updated++;
      } else {
        summary.inserted++;
      }
    }

    console.log("");
    console.log("======================================");

    console.log("SYNC DONE");

    console.log(summary);

    console.log("======================================");

    return summary;
  } finally {
    client.release();
  }
}

module.exports = {
  syncHsdcRainStations,
  fetchHsdcStations,
};
