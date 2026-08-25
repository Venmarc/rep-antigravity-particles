import { useEffect, useRef, useState } from "react";
import { FadeHeader } from "../components/capsule-header";
import ParticleSwarmCanvas from "../components/particle-swarm";
import DraggablePanel from "../components/control-panel";

const PRESETS = ["{ }", "%", "#", "OX", "🧑", "6"];

/** No pure white/black: light = warm peach, dark = deep indigo. */
const PALETTES = {
  dark: {
    bg: "#141433",
    fg: "#e4e2f7",
    dim: "#a09ecb",
    line: "#3d3d73",
    swarmColors: ["#9aa8ff", "#4a5df9", "#2a2a5e"] as [
      string,
      string,
      string,
    ],
  },
  light: {
    bg: "#fdeee3",
    fg: "#38222c",
    dim: "#93707a",
    line: "#e8cdb9",
    swarmColors: ["#2c64ed", "#f84242", "#ffcf03"] as [
      string,
      string,
      string,
    ],
  },
};

/** Type & Swarm — type any character/emoji; the swarm morphs into it.
 *  Click-driven: presets activate on click, not hover. An empty input sends
 *  the particles to rest (homes + idle drift); a non-empty input forms the
 *  glyph and holds it regardless of input focus. */
export default function Playground() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [text, setText] = useState("{ }");
  const [glyph, setGlyph] = useState("{ }");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pal = PALETTES[theme];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = (v: string) => {
    setText(v);
    if (v.trim()) setGlyph(v);
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col transition-colors duration-500"
      style={
        {
          background: pal.bg,
          color: pal.fg,
          "--panel-bg": pal.bg,
          "--panel-line": pal.line,
          "--pg-bg": pal.bg,
          "--pg-fg": pal.fg,
        } as React.CSSProperties
      }
    >
      <FadeHeader />
      <main className="relative flex flex-1 flex-col">
        <ParticleSwarmCanvas
          className="absolute inset-0"
          mode="morph"
          theme={theme}
          colors={pal.swarmColors}
          density={50}
          glyph={glyph}
          active={text.trim().length > 0}
        />
        <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-6 pb-16">
          <DraggablePanel>
            <p className="mb-6 max-w-sm text-center text-sm leading-relaxed opacity-60">
              Type anything. Every glyph becomes a field of pressure the
              particles stream toward. Emoji included. Drag this panel out of
              the way to watch the full formation.
            </p>
            <div className="flex items-center justify-center gap-3">
              <label className="sr-only" htmlFor="glyph-input">
                Glyph to morph into
              </label>
              <input
                id="glyph-input"
                ref={inputRef}
                value={text}
                maxLength={3}
                placeholder={glyph}
                onChange={(e) => commit(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="w-40 rounded-2xl px-5 py-4 text-center text-4xl outline-none backdrop-blur-md transition-shadow duration-500"
                style={{
                  background: `color-mix(in srgb, ${pal.fg} 8%, transparent)`,
                  color: pal.fg,
                  boxShadow: focused
                    ? `0 0 0 1px color-mix(in srgb, ${pal.dim} 55%, transparent)`
                    : "0 0 0 1px transparent",
                }}
              />
              <button
                onClick={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
                className="h-11 rounded-full px-4 text-sm backdrop-blur-md transition-all duration-300"
                style={{
                  background: `color-mix(in srgb, ${pal.fg} 8%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${pal.line} 80%, transparent)`,
                }}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              >
                {theme === "dark" ? "☀ Light" : "☾ Dark"}
              </button>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => commit(p)}
                  className={`h-11 min-w-11 rounded-full px-3 text-lg backdrop-blur-md transition-all duration-300 ${
                    glyph === p ? "scale-110" : ""
                  }`}
                  style={{
                    background:
                      glyph === p
                        ? `color-mix(in srgb, ${pal.fg} 18%, transparent)`
                        : `color-mix(in srgb, ${pal.fg} 7%, transparent)`,
                  }}
                  aria-label={`Morph to ${p}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </DraggablePanel>
        </div>
      </main>
    </div>
  );
}
