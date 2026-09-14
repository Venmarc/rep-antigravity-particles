import type { GlyphItem, GlyphSpec } from "../components/particle-swarm/engine";

/**
 * Shared data for the Day page and its full-page field views.
 * Glyph space is 500x500, centre (250, 250). Morph-mode framing
 * (camera z 8.8, meshScale 5) shows roughly the inner +/-0.64 of
 * normalized glyph space, so every recipe must keep its ink inside
 * (edge + half glyph size) / 250 <= ~0.62 or it clips.
 */

/** 15:00 — six people around a table, hexagon layout. */
export const CREW: GlyphItem[] = [
  { text: "🚀", x: 250, y: 145, size: 95 },
  { text: "🔥", x: 341, y: 198, size: 95 },
  { text: "✨", x: 341, y: 303, size: 95 },
  { text: "🌊", x: 250, y: 355, size: 95 },
  { text: "🎯", x: 159, y: 303, size: 95 },
  { text: "⚡", x: 159, y: 198, size: 95 },
];

export interface Hour {
  clock: string;
  role: string;
  note: string;
  /** flat "exposure" for hours without a live field */
  sky?: string;
  /** live morph target shown inside the photograph */
  glyph?: GlyphSpec;
  /** full-page field route slug (photo is clickable) */
  field?: "analyst" | "crew";
}

export const HOURS: Hour[] = [
  {
    clock: "06:00",
    role: "the opener",
    note: "lights on, machines warm",
    sky: "linear-gradient(180deg, #232f55 0%, #8a5a4a 62%, #e8a05e 100%)",
  },
  {
    clock: "09:00",
    role: "the analyst",
    note: "every number, every morning",
    glyph: "%",
    field: "analyst",
  },
  {
    clock: "12:00",
    role: "the courier",
    note: "parcels out, receipts in",
    sky: "linear-gradient(180deg, #cfe0ef 0%, #f2ead9 100%)",
  },
  {
    clock: "15:00",
    role: "the crew",
    note: "six people, one deadline",
    glyph: CREW,
    field: "crew",
  },
  {
    clock: "18:00",
    role: "the closer",
    note: "locks up, keeps the keys",
    sky: "linear-gradient(180deg, #241a38 0%, #6e3a50 58%, #d97e4a 100%)",
  },
];

/** Full-page field views: only the glyph, a back button, nothing else. */
export const FIELDS: Record<
  "analyst" | "crew",
  { glyph: GlyphSpec; role: string }
> = {
  analyst: { glyph: "%", role: "the analyst" },
  crew: { glyph: CREW, role: "the crew" },
};

export const PALETTES = {
  dark: {
    bg: "#101022",
    fg: "#e4e2f7",
    line: "#3d3d73",
    photo: "#141433",
    paper: "#f4f2ec",
    ink: "#1b1b22",
    swarmColors: ["#9aa8ff", "#4a5df9", "#2a2a5e"] as [string, string, string],
  },
  light: {
    bg: "#efe7dc",
    fg: "#38222c",
    line: "#e0c8b4",
    photo: "#f3e1cb",
    paper: "#fbfaf6",
    ink: "#242017",
    swarmColors: ["#2c64ed", "#f84242", "#ffcf03"] as [string, string, string],
  },
};

/** Day-page state that must survive navigating to a field page and back.
 *  Module scope: lives as long as the session, no store library needed. */
export const dayState = {
  theme: "dark" as "dark" | "light",
  open: 1,
};
