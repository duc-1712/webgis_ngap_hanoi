import rasterio

file_path = "hanoi_cop30.tif"

with rasterio.open(file_path) as src:
    print("CRS:", src.crs)
    print("Bounds:", src.bounds)
    print("Resolution:", src.res)
    print("Width:", src.width)
    print("Height:", src.height)
    print("NoData:", src.nodata)