import { useState } from "react";
import { Link } from "react-router-dom";
import ParticleSwarmCanvas from "../components/particle-swarm";
import { FIELDS, PALETTES, dayState } from "./day-fields";

/** Full-page field: only the glyph, a back button, nothing else.
 *  The shape is held from the start (active, no hover gate) so the
 *  formation is the page; the cursor still turns the pills. Theme
 *  follows whatever the day page was on. */
export default function DayField({ kind }: { kind: "analyst" | "crew" }) {
  const field = FIELDS[kind];
  const [theme] = useState(dayState.theme);
  const pal = PALETTES[theme];

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: pal.bg }}
      data-day-field-page={kind}
    >
      <ParticleSwarmCanvas
        className="absolute inset-0"
        mode="morph"
        theme={theme}
        colors={pal.swarmColors}
        density={50}
        glyph={field.glyph}
        active
      />
      <Link
        to="/day"
        data-back-button
        aria-label="Back to the day"
        className="fixed left-5 top-5 z-10 flex h-11 items-center rounded-full px-4 text-sm backdrop-blur-md transition-transform duration-300 hover:scale-[1.03]"
        style={{
          color: pal.fg,
          background: `color-mix(in srgb, ${pal.bg} 55%, transparent)`,
          border: `1px solid color-mix(in srgb, ${pal.line} 80%, transparent)`,
        }}
      >
        ← Day
      </Link>
    </div>
  );
}
