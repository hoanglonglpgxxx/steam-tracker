// client/src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import UpdateTime from "./UpdateTime"; // Import file vừa tạo

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Đây là nơi định nghĩa đường dẫn */}
        {/* Khi người dùng vào link /reminder/123/update -> Hiện giao diện UpdateTime */}
        <Route path="/reminder/:id/update" element={<UpdateTime />} />

        {/* Bạn có thể thêm các route khác sau này */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
