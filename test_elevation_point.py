import rasterio

DEM_FILE = "hanoi_cop30.tif"

# Ví dụ điểm HSDC
latitude = 21.041384
longitude = 105.828879

with rasterio.open(DEM_FILE) as dem:

    print("EPSG:", dem.crs.to_epsg())

    value = list(
        dem.sample([
            (longitude, latitude)
        ])
    )[0][0]

    print("")
    print("Latitude :", latitude)
    print("Longitude:", longitude)
    print("Elevation:", float(value), "m")