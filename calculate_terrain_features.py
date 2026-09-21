import os
import math
import numpy as np
import rasterio
import psycopg2

from rasterio.warp import (
    calculate_default_transform,
    reproject,
    Resampling
)

from pyproj import Transformer


# =====================================================
# CẤU HÌNH
# =====================================================

SOURCE_DEM = "hanoi_cop30.tif"

# DEM sau khi đổi sang hệ tọa độ mét
UTM_DEM = "hanoi_cop30_utm.tif"

# Hà Nội nằm trong UTM Zone 48N
UTM_CRS = "EPSG:32648"

# Bán kính tính cao độ tương đối
RELATIVE_RADIUS_METERS = 300


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
# 1. REPROJECT DEM SANG UTM 48N
# =====================================================

def reproject_dem():

    if os.path.exists(UTM_DEM):
        print("✓ DEM UTM đã tồn tại:", UTM_DEM)
        return

    print("")
    print("=================================")
    print("REPROJECT DEM -> EPSG:32648")
    print("=================================")

    with rasterio.open(SOURCE_DEM) as src:

        transform, width, height = (
            calculate_default_transform(
                src.crs,
                UTM_CRS,
                src.width,
                src.height,
                *src.bounds
            )
        )

        kwargs = src.meta.copy()

        kwargs.update({
            "crs": UTM_CRS,
            "transform": transform,
            "width": width,
            "height": height
        })

        with rasterio.open(
            UTM_DEM,
            "w",
            **kwargs
        ) as dst:

            for i in range(
                1,
                src.count + 1
            ):

                reproject(
                    source=rasterio.band(
                        src,
                        i
                    ),

                    destination=rasterio.band(
                        dst,
                        i
                    ),

                    src_transform=
                        src.transform,

                    src_crs=
                        src.crs,

                    dst_transform=
                        transform,

                    dst_crs=
                        UTM_CRS,

                    resampling=
                        Resampling.bilinear
                )

    print(
        "✓ Đã tạo:",
        UTM_DEM
    )


# =====================================================
# 2. TÍNH SLOPE THEO HORN 3x3
# =====================================================

def calculate_slope(
    dem,
    row,
    col
):

    # Điểm sát mép raster không đủ 3x3
    if (
        row <= 0 or
        col <= 0 or
        row >= dem.height - 1 or
        col >= dem.width - 1
    ):
        return None

    window = rasterio.windows.Window(
        col - 1,
        row - 1,
        3,
        3
    )

    data = dem.read(
        1,
        window=window
    ).astype(float)

    if data.shape != (3, 3):
        return None

    if np.isnan(data).any():
        return None

    # -----------------------------------------
    # z1 z2 z3
    # z4 z5 z6
    # z7 z8 z9
    # -----------------------------------------

    z1 = data[0, 0]
    z2 = data[0, 1]
    z3 = data[0, 2]

    z4 = data[1, 0]
    z5 = data[1, 1]
    z6 = data[1, 2]

    z7 = data[2, 0]
    z8 = data[2, 1]
    z9 = data[2, 2]

    cell_x = abs(
        dem.transform.a
    )

    cell_y = abs(
        dem.transform.e
    )

    # Horn algorithm

    dzdx = (
        (
            z3 +
            2 * z6 +
            z9
        )
        -
        (
            z1 +
            2 * z4 +
            z7
        )
    ) / (
        8 * cell_x
    )

    dzdy = (
        (
            z7 +
            2 * z8 +
            z9
        )
        -
        (
            z1 +
            2 * z2 +
            z3
        )
    ) / (
        8 * cell_y
    )

    slope_radians = math.atan(
        math.sqrt(
            dzdx ** 2 +
            dzdy ** 2
        )
    )

    slope_degrees = math.degrees(
        slope_radians
    )

    return slope_degrees


# =====================================================
# 3. RELATIVE ELEVATION
# =====================================================

def calculate_relative_elevation(
    dem,
    row,
    col,
    point_elevation
):

    pixel_size = abs(
        dem.transform.a
    )

    radius_pixels = int(
        RELATIVE_RADIUS_METERS /
        pixel_size
    )

    # ít nhất 1 pixel
    radius_pixels = max(
        radius_pixels,
        1
    )

    row_start = max(
        0,
        row - radius_pixels
    )

    row_end = min(
        dem.height,
        row + radius_pixels + 1
    )

    col_start = max(
        0,
        col - radius_pixels
    )

    col_end = min(
        dem.width,
        col + radius_pixels + 1
    )

    window = rasterio.windows.Window(
        col_start,
        row_start,
        col_end - col_start,
        row_end - row_start
    )

    data = dem.read(
        1,
        window=window
    ).astype(float)

    # -----------------------------------------
    # Xử lý NoData nếu có
    # -----------------------------------------

    if dem.nodata is not None:

        data[
            data == dem.nodata
        ] = np.nan

    valid = data[
        np.isfinite(data)
    ]

    if len(valid) == 0:
        return None

    mean_elevation = float(
        np.mean(valid)
    )

    relative = (
        point_elevation
        -
        mean_elevation
    )

    return relative


# =====================================================
# MAIN
# =====================================================

def main():

    # -----------------------------------------
    # Tạo DEM UTM
    # -----------------------------------------

    reproject_dem()

    # -----------------------------------------
    # Transformer:
    # GPS WGS84 -> UTM 48N
    # -----------------------------------------

    transformer = Transformer.from_crs(
        "EPSG:4326",
        UTM_CRS,
        always_xy=True
    )

    # -----------------------------------------
    # Lấy điểm PostgreSQL
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

    points = cursor.fetchall()

    print("")
    print("=================================")
    print("TERRAIN FEATURES")
    print("=================================")

    print(
        "Số điểm:",
        len(points)
    )

    print(
        "Relative radius:",
        RELATIVE_RADIUS_METERS,
        "m"
    )

    print("")

    # -----------------------------------------
    # Mở DEM UTM
    # -----------------------------------------

    with rasterio.open(
        UTM_DEM
    ) as dem:

        print(
            "DEM CRS:",
            dem.crs
        )

        print(
            "Resolution:",
            dem.res
        )

        print("")

        for point in points:

            (
                point_id,
                hsdc_id,
                name,
                lat,
                lon
            ) = point

            lat = float(lat)
            lon = float(lon)

            try:

                # =====================================
                # GPS -> UTM
                # =====================================

                x, y = transformer.transform(
                    lon,
                    lat
                )

                # =====================================
                # UTM -> pixel
                # =====================================

                row, col = dem.index(
                    x,
                    y
                )

                # =====================================
                # Kiểm tra raster
                # =====================================

                if (
                    row < 0 or
                    col < 0 or
                    row >= dem.height or
                    col >= dem.width
                ):

                    print(
                        f"✗ {hsdc_id} | "
                        f"{name} | "
                        "Ngoài DEM"
                    )

                    continue

                # =====================================
                # ELEVATION
                # =====================================

                point_elevation = float(
                    dem.read(
                        1,
                        window=
                        rasterio.windows.Window(
                            col,
                            row,
                            1,
                            1
                        )
                    )[0, 0]
                )

                # =====================================
                # SLOPE
                # =====================================

                slope = calculate_slope(
                    dem,
                    row,
                    col
                )

                # =====================================
                # RELATIVE ELEVATION
                # =====================================

                relative_elevation = (
                    calculate_relative_elevation(
                        dem,
                        row,
                        col,
                        point_elevation
                    )
                )

                # =====================================
                # HIỂN THỊ
                # =====================================

                slope_text = (
                    f"{slope:.3f}°"
                    if slope is not None
                    else "NULL"
                )

                relative_text = (
                    f"{relative_elevation:.3f} m"
                    if relative_elevation
                    is not None
                    else "NULL"
                )

                print(
                    f"✓ {hsdc_id} | "
                    f"{name}"
                )

                print(
                    f"   Elevation: "
                    f"{point_elevation:.2f} m"
                )

                print(
                    f"   Slope: "
                    f"{slope_text}"
                )

                print(
                    f"   Relative: "
                    f"{relative_text}"
                )

                # =====================================
                # UPDATE POSTGRESQL
                # =====================================

                cursor.execute("""
                    UPDATE flood_points

                    SET
                        elevation = %s,
                        slope = %s,
                        relative_elevation = %s,
                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = %s
                """, (
                    point_elevation,
                    slope,
                    relative_elevation,
                    point_id
                ))

            except Exception as error:

                print(
                    f"✗ {hsdc_id} | "
                    f"{name}"
                )

                print(
                    "   Lỗi:",
                    error
                )

    # =============================================
    # COMMIT
    # =============================================

    conn.commit()

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