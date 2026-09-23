import time
from datetime import datetime, timedelta

import requests
import psycopg2

from psycopg2.extras import execute_values


# =====================================================
# CONFIG
# =====================================================

API_URL = (
    "https://historical-forecast-api.open-meteo.com/v1/forecast"
)

START_DATE = "2024-01-01"
END_DATE = "2026-09-23"


BATCH_SIZE = 15

DAYS_PER_REQUEST = 30

PROVIDER = "OPEN_METEO_HISTORICAL_FORECAST"


# =====================================================
# DATABASE
# =====================================================

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="webgis_ngap_hanoi",
    user="postgres",
    password="Duc_1712"
)

cursor = conn.cursor()


# =====================================================
# CHIA LIST THÀNH BATCH
# =====================================================

def chunks(data, size):

    for i in range(
        0,
        len(data),
        size
    ):

        yield data[
            i:i + size
        ]


# =====================================================
# CHIA THỜI GIAN
# =====================================================

def date_ranges(
    start_date,
    end_date
):

    start = datetime.strptime(
        start_date,
        "%Y-%m-%d"
    ).date()

    end = datetime.strptime(
        end_date,
        "%Y-%m-%d"
    ).date()

    current = start

    while current <= end:

        chunk_end = min(
            current +
            timedelta(
                days=DAYS_PER_REQUEST - 1
            ),
            end
        )

        yield (
            current.isoformat(),
            chunk_end.isoformat()
        )

        current = (
            chunk_end +
            timedelta(days=1)
        )


# =====================================================
# GỌI OPEN-METEO
# =====================================================

def fetch_openmeteo(
    points,
    start_date,
    end_date
):

    latitudes = ",".join(
        str(point["latitude"])
        for point in points
    )

    longitudes = ",".join(
        str(point["longitude"])
        for point in points
    )

    params = {

        "latitude":
            latitudes,

        "longitude":
            longitudes,

        "start_date":
            start_date,

        "end_date":
            end_date,

        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "rain",
            "soil_moisture_0_to_1cm"
        ]),

        "timezone":
            "Asia/Ho_Chi_Minh",

        "cell_selection":
            "nearest"
    }

    for attempt in range(
        1,
        4
    ):

        try:

            response = requests.get(
                API_URL,
                params=params,
                timeout=120
            )

            if response.status_code == 200:

                return response.json()

            print(
                "HTTP:",
                response.status_code
            )

            print(
                response.text
            )

        except Exception as error:

            print(
                "Lỗi request:",
                error
            )

        print(
            f"Thử lại {attempt}/3..."
        )

        time.sleep(
            attempt * 5
        )

    return None


# =====================================================
# PARSE 1 LOCATION
# =====================================================

def parse_location(
    point,
    data
):

    hourly = data.get(
        "hourly",
        {}
    )

    times = hourly.get(
        "time",
        []
    )

    temperature = hourly.get(
        "temperature_2m",
        []
    )

    humidity = hourly.get(
        "relative_humidity_2m",
        []
    )

    precipitation = hourly.get(
        "precipitation",
        []
    )

    rain = hourly.get(
        "rain",
        []
    )

    soil = hourly.get(
        "soil_moisture_0_to_1cm",
        []
    )

    meteo_latitude = data.get(
        "latitude"
    )

    meteo_longitude = data.get(
        "longitude"
    )

    rows = []

    for i in range(
        len(times)
    ):

        rows.append((
            point["id"],

            times[i],

            temperature[i]
            if i < len(temperature)
            else None,

            humidity[i]
            if i < len(humidity)
            else None,

            precipitation[i]
            if i < len(precipitation)
            else None,

            rain[i]
            if i < len(rain)
            else None,

            soil[i]
            if i < len(soil)
            else None,

            point["latitude"],
            point["longitude"],

            meteo_latitude,
            meteo_longitude,

            PROVIDER
        ))

    return rows


# =====================================================
# INSERT POSTGRESQL
# =====================================================

def save_rows(rows):

    if not rows:
        return

    sql = """
        INSERT INTO weather_history
        (
            flood_point_id,
            recorded_at,

            temperature_2m,
            relative_humidity_2m,

            precipitation,
            rain,

            soil_moisture_0_to_1cm,

            requested_latitude,
            requested_longitude,

            meteo_latitude,
            meteo_longitude,

            provider
        )

        VALUES %s

        ON CONFLICT
        (
            flood_point_id,
            recorded_at,
            provider
        )

        DO UPDATE SET

            temperature_2m =
                EXCLUDED.temperature_2m,

            relative_humidity_2m =
                EXCLUDED.relative_humidity_2m,

            precipitation =
                EXCLUDED.precipitation,

            rain =
                EXCLUDED.rain,

            soil_moisture_0_to_1cm =
                EXCLUDED.soil_moisture_0_to_1cm,

            requested_latitude =
                EXCLUDED.requested_latitude,

            requested_longitude =
                EXCLUDED.requested_longitude,

            meteo_latitude =
                EXCLUDED.meteo_latitude,

            meteo_longitude =
                EXCLUDED.meteo_longitude
    """

    execute_values(
        cursor,
        sql,
        rows,
        page_size=5000
    )

    conn.commit()


# =====================================================
# MAIN
# =====================================================

def main():

    print("")
    print("=================================")
    print("OPEN-METEO HISTORY DOWNLOAD")
    print("=================================")

    # -----------------------------------------
    # Lấy flood points
    # -----------------------------------------

    cursor.execute("""
        SELECT
            id,
            hsdc_id,
            name,
            latitude,
            longitude

        FROM flood_points

        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL

        ORDER BY id
    """)

    db_points = cursor.fetchall()

    points = []

    for row in db_points:

        points.append({

            "id":
                row[0],

            "hsdc_id":
                row[1],

            "name":
                row[2],

            "latitude":
                float(row[3]),

            "longitude":
                float(row[4])
        })

    print(
        "Số điểm:",
        len(points)
    )

    print(
        "Từ:",
        START_DATE
    )

    print(
        "Đến:",
        END_DATE
    )

    print("")

    # =========================================
    # CHIA THỜI GIAN
    # =========================================

    for (
        period_start,
        period_end
    ) in date_ranges(
        START_DATE,
        END_DATE
    ):

        print("")
        print(
            "================================="
        )

        print(
            period_start,
            "->",
            period_end
        )

        print(
            "================================="
        )

        # =====================================
        # CHIA POINT BATCH
        # =====================================

        point_batches = list(
            chunks(
                points,
                BATCH_SIZE
            )
        )

        for batch_index, batch in enumerate(
            point_batches,
            start=1
        ):

            print(
                f"Batch "
                f"{batch_index}/"
                f"{len(point_batches)}"
            )

            print(
                "Số điểm:",
                len(batch)
            )

            # ---------------------------------
            # API
            # ---------------------------------

            result = fetch_openmeteo(
                batch,
                period_start,
                period_end
            )

            if result is None:

                print(
                    "✗ Không lấy được batch"
                )

                continue

            # ---------------------------------
            # Nếu nhiều tọa độ,
            # Open-Meteo trả list
            # ---------------------------------

            if isinstance(
                result,
                dict
            ):

                results = [
                    result
                ]

            else:

                results = result

            print(
                "Locations trả về:",
                len(results)
            )

            # ---------------------------------
            # Kiểm tra số location
            # ---------------------------------

            if len(results) != len(batch):

                print(
                    "⚠ Số location trả về "
                    "không khớp batch"
                )

            all_rows = []

            # ---------------------------------
            # Ghép response với point
            # theo đúng thứ tự
            # ---------------------------------

            for point, location_data in zip(
                batch,
                results
            ):

                rows = parse_location(
                    point,
                    location_data
                )

                all_rows.extend(
                    rows
                )

                print(
                    f"  ✓ "
                    f"{point['hsdc_id']} | "
                    f"{point['name']}"
                )

                print(
                    "    Requested:",
                    point["latitude"],
                    point["longitude"]
                )

                print(
                    "    Grid:",
                    location_data.get(
                        "latitude"
                    ),
                    location_data.get(
                        "longitude"
                    )
                )

                print(
                    "    Hours:",
                    len(rows)
                )

            # ---------------------------------
            # SAVE
            # ---------------------------------

            save_rows(
                all_rows
            )

            print(
                "✓ Saved rows:",
                len(all_rows)
            )

            # nghỉ nhẹ
            time.sleep(2)

    print("")
    print("=================================")
    print("HOÀN THÀNH")
    print("=================================")


# =====================================================
# RUN
# =====================================================

try:

    main()

finally:

    cursor.close()
    conn.close()