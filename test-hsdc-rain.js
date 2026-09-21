const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const HSDC_RAIN_URL =
  "https://thoatnuochanoi.vn/rain/Contains/ajax/thuytri.ashx";

async function testHsdcRainStations() {
  try {
    console.log("=================================");
    console.log("TEST HSDC RAIN STATIONS");
    console.log("=================================");

    const response = await axios.get(HSDC_RAIN_URL, {
      params: {
        type: "getMua",
      },
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
      },
    });

    const html = response.data;

    if (!html || typeof html !== "string") {
      throw new Error("HSDC không trả về HTML hợp lệ");
    }

    const $ = cheerio.load(html);

    const stations = [];

    $('[id^="tram_"]').each((index, element) => {
      const container = $(element);

      const rawId = container.attr("id") || "";

      const stationId = Number(rawId.replace("tram_", ""));

      const name = container
        .find(".tentram2")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const address = container
        .find(".diachi2")
        .text()
        .replace(/[()]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const imagePath = container.find(".luongmua img").attr("src");

      let imageUrl = null;

      if (imagePath) {
        const cleanPath = imagePath.split("?")[0];

        imageUrl = cleanPath.startsWith("http")
          ? cleanPath
          : `https://thoatnuochanoi.vn${cleanPath}`;
      }

      stations.push({
        station_id: stationId,
        name: name,
        address: address,
        image_url: imageUrl,
      });
    });

    console.log("");
    console.log("Số trạm lấy được:", stations.length);

    console.log("");

    console.table(
      stations.map((station) => ({
        station_id: station.station_id,
        name: station.name,
        address: station.address,
        image_url: station.image_url,
      })),
    );

    // Lưu ra file JSON để kiểm tra
    fs.writeFileSync(
      "hsdc-rain-stations.json",
      JSON.stringify(
        {
          success: true,
          count: stations.length,
          data: stations,
        },
        null,
        2,
      ),
      "utf8",
    );

    console.log("");
    console.log("✓ Đã lưu file hsdc-rain-stations.json");
  } catch (error) {
    console.error("");
    console.error("✗ Lỗi:", error.message);

    if (error.response) {
      console.error("HTTP status:", error.response.status);

      console.error("Response:", error.response.data);
    }
  }
}

testHsdcRainStations();
