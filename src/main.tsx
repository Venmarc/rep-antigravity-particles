import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

// pages are route-split: the visiting page's chunk loads on demand, keeping
// the critical bundle to react-dom + shell
const OxHero = lazy(() => import("./pages/OxHero"));
const Signal = lazy(() => import("./pages/Signal"));
const Playground = lazy(() => import("./pages/Playground"));

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
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
