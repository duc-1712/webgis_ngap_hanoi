import rasterio
import psycopg2

DEM_FILE = "hanoi_cop30.tif"

# ==============================
# DATABASE
# ==============================

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="webgis_ngap_hanoi",
    user="postgres",
    password="Duc_1712"
)

cursor = conn.cursor()

# ==============================
# LẤY ĐIỂM NGẬP
# ==============================

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
""")

points = cursor.fetchall()

print("=================================")
print("EXTRACT ELEVATION")
print("=================================")
print("Số điểm:", len(points))
print("")

# ==============================
# MỞ DEM
# ==============================

with rasterio.open(DEM_FILE) as dem:

    print("CRS:", dem.crs)
    print("Bounds:", dem.bounds)
    print("")

    for point in points:

        point_id = point[0]
        hsdc_id = point[1]
        name = point[2]

        lat = float(point[3])
        lon = float(point[4])

        try:

            # =================================
            # KIỂM TRA NẰM TRONG DEM
            # =================================

            if not (
                dem.bounds.left <= lon <= dem.bounds.right
                and
                dem.bounds.bottom <= lat <= dem.bounds.top
            ):

                print(
                    f"✗ {hsdc_id} | {name} | "
                    f"Nằm ngoài DEM"
                )

                continue

            # =================================
            # SAMPLE DEM
            #
            # X = longitude
            # Y = latitude
            # =================================

            value = list(
                dem.sample([
                    (lon, lat)
                ])
            )[0][0]

            elevation = float(value)

            print(
                f"✓ {hsdc_id} | "
                f"{name} | "
                f"{elevation:.2f} m"
            )

            # =================================
            # UPDATE DATABASE
            # =================================

            cursor.execute("""
                UPDATE flood_points

                SET
                    elevation = %s,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = %s
            """, (
                elevation,
                point_id
            ))

        except Exception as error:

            print(
                f"✗ {hsdc_id} | "
                f"{name} | "
                f"Lỗi: {error}"
            )

# ==============================
# COMMIT
# ==============================

conn.commit()

cursor.close()
conn.close()

print("")
print("=================================")
print("HOÀN THÀNH")
print("=================================")