// client/src/UpdateTime.js
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

function UpdateTime() {
  const { id } = useParams(); // Lấy ID từ trên thanh địa chỉ URL
  const navigate = useNavigate(); // Dùng để chuyển trang sau khi lưu xong

  // Khai báo biến (State) - Giống như khai báo var trong jQuery
  const [dateVal, setDateVal] = useState("");
  const [timeVal, setTimeVal] = useState("");
  const [msg, setMsg] = useState(""); // Thông báo lỗi/thành công

  const API_URL = `http://34.70.65.137:8000/api/v1/reminder/${id}`;

  // 1. Tương tự $(document).ready(): Chạy ngay khi mở trang
  useEffect(() => {
    // Hàm lấy dữ liệu cũ
    const loadData = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();

        // Giả sử server trả về cấu trúc { data: { time: "..." } } hoặc { time: "..." }
        // Bạn cần console.log(data) để xem cấu trúc chính xác nhé
        const reminder = data.data || data;

        if (reminder && reminder.time) {
          const d = new Date(reminder.time);
          // Format lại để điền vào input
          setDateVal(d.toISOString().split("T")[0]); // YYYY-MM-DD
          setTimeVal(d.toTimeString().slice(0, 5)); // HH:mm
        }
      } catch (err) {
        console.log("Lỗi tải dữ liệu", err);
      }
    };
    loadData();
  }, [id, API_URL]);

  // 2. Tương tự $('#btnSave').click(): Chạy khi bấm nút submit
  const handleSave = async (e) => {
    e.preventDefault(); // Chặn load lại trang
    setMsg("Đang lưu...");

    // Gộp ngày giờ lại
    const fullTime = new Date(`${dateVal}T${timeVal}`);

    try {
      // Gọi API PATCH cập nhật (Method B bạn đã chọn)
      const res = await fetch(`${API_URL}/updateTime`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTime: fullTime.toISOString() }),
      });

      const result = await res.json();

      if (res.ok) {
        alert("Thành công!");
        setMsg("Cập nhật thành công!");
        // navigate('/success'); // Nếu muốn chuyển trang khác
      } else {
        setMsg("Lỗi: " + result.message);
      }
    } catch (err) {
      setMsg("Lỗi kết nối server!");
    }
  };

  // Phần Giao Diện (HTML)
  return (
    <div
      style={{
        padding: "50px",
        maxWidth: "400px",
        margin: "0 auto",
        fontFamily: "Arial",
      }}
    >
      <h2 style={{ textAlign: "center" }}>Cập nhật giờ Reminder</h2>

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontWeight: "bold" }}>Ngày:</label>
          <input
            type="date"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontWeight: "bold" }}>Giờ:</label>
          <input
            type="time"
            value={timeVal}
            onChange={(e) => setTimeVal(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px",
            background: "blue",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Lưu Thay Đổi
        </button>

        {msg && (
          <p style={{ textAlign: "center", marginTop: "10px", color: "red" }}>{msg}</p>
        )}
      </form>
    </div>
  );
}

export default UpdateTime;
