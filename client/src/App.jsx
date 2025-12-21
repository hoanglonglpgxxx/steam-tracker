// client/src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import UpdateTime from "./UpdateTime";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reminder/:id/update" element={<UpdateTime />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
