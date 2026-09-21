import requests
import json

url = "https://historical-forecast-api.open-meteo.com/v1/forecast"

params = {
    "latitude": 21.041384,
    "longitude": 105.828879,

    "start_date": "2026-09-01",
    "end_date": "2026-09-05",

    "hourly": ",".join([
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "rain",
        "soil_moisture_0_to_1cm"
    ]),

    "timezone": "Asia/Ho_Chi_Minh",

    # ưu tiên grid gần nhất với tọa độ request
    "cell_selection": "nearest"
}

print("Đang gọi Open-Meteo Historical Forecast...")

response = requests.get(
    url,
    params=params,
    timeout=60
)

print("HTTP:", response.status_code)

if response.status_code != 200:
    print(response.text)
    exit()

data = response.json()

print("")
print("Requested:")
print("Latitude :", params["latitude"])
print("Longitude:", params["longitude"])

print("")
print("Open-Meteo grid:")
print("Latitude :", data.get("latitude"))
print("Longitude:", data.get("longitude"))

print("")
print("Timezone:", data.get("timezone"))

hourly = data.get("hourly", {})

times = hourly.get("time", [])
rain = hourly.get("rain", [])
precipitation = hourly.get("precipitation", [])
temperature = hourly.get("temperature_2m", [])
humidity = hourly.get("relative_humidity_2m", [])
soil = hourly.get("soil_moisture_0_to_1cm", [])

print("")
print("Số giờ:", len(times))
print("")

for i in range(min(24, len(times))):
    print(
        times[i],
        "| rain:", rain[i],
        "| precipitation:", precipitation[i],
        "| temp:", temperature[i],
        "| humidity:", humidity[i],
        "| soil:", soil[i]
    )

with open(
    "openmeteo-history-test.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        data,
        f,
        ensure_ascii=False,
        indent=2
    )

print("")
print("✓ Đã lưu openmeteo-history-test.json")