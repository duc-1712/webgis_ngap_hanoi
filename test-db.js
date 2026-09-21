const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "webgis_ngap_hanoi",
  user: "postgres",
  password: "",
});

async function test() {
  try {
    console.log("Đang kết nối PostgreSQL...");

    const result = await pool.query("SELECT NOW() AS time");

    console.log("KẾT NỐI PostgreSQL THÀNH CÔNG!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("POSTGRESQL ERROR:");
    console.error(error);
  } finally {
    await pool.end();
  }
}

test();
