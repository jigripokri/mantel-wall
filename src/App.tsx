import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TvWall } from "./tv/TvWall";
import { PhoneHome } from "./phone/PhoneHome";
import { Landing } from "./auth/Landing";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* `/` shows the landing page to visitors and the phone view to family,
            which means the family can never actually look at the page they're
            sharing. `/about` renders it unconditionally — a stable link to send
            people, and the only way to check it without signing out. */}
        <Route path="/" element={<PhoneHome />} />
        <Route path="/about" element={<Landing />} />
        <Route path="/tv" element={<TvWall />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
