import requests

API_KEY = "7ce2d61de7852b355dfd7aa5e7ea967f"

url = "https://portal.opentopography.org/API/globaldem"

params = {
    "demtype": "COP30",

    # Hà Nội
    "south": 20.55,
    "north": 21.40,
    "west": 105.25,
    "east": 106.05,

    "outputFormat": "GTiff",

    "API_Key": API_KEY
}

print("=================================")
print("DOWNLOAD COPERNICUS DEM HANOI")
print("=================================")

try:
    response = requests.get(
        url,
        params=params,
        timeout=180
    )

    print("HTTP:", response.status_code)

    if response.status_code != 200:
        print("Lỗi:")
        print(response.text)
        exit()

    with open(
        "hanoi_cop30.tif",
        "wb"
    ) as file:
        file.write(response.content)

    print("")
    print("✓ Download thành công")
    print("✓ File: hanoi_cop30.tif")
    print(
        "✓ Size:",
        round(len(response.content) / 1024 / 1024, 2),
        "MB"
    )

except Exception as error:
    print("✗ Lỗi:", error)