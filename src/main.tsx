import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

// pages are route-split: the visiting page's chunk loads on demand, keeping
// the critical bundle to react-dom + shell
const OxHero = lazy(() => import("./pages/OxHero"));
const Signal = lazy(() => import("./pages/Signal"));
const Playground = lazy(() => import("./pages/Playground"));
const Day = lazy(() => import("./pages/Day"));
const DayField = lazy(() => import("./pages/DayField"));

function Fallback() {
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<OxHero />} />
          <Route path="/signal" element={<Signal />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/day" element={<Day />} />
          <Route path="/day/analyst" element={<DayField kind="analyst" />} />
          <Route path="/day/crew" element={<DayField kind="crew" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
