import type { ReactNode } from "react";

interface PolaroidProps {
  /** the "photograph": a live particle field or a colour panel */
  photo: ReactNode;
  /** job title, handwritten on the caption strip */
  role: string;
  /** one concrete line about the hour */
  note: string;
  /** paper colour of the frame */
  paper: string;
  /** caption ink */
  ink: string;
  /** photograph backing (matches the page field colour) */
  photoBg: string;
  /** slight rotation so the stack reads as physical prints */
  rotate?: number;
  className?: string;
}

/** Instant-photo frame: paper border, square exposure, caption under it.
 *  The exposure area is square and theme-coloured; the paper stays paper. */
export default function Polaroid({
  photo,
  role,
  note,
  paper,
  ink,
  photoBg,
  rotate = 0,
  className = "",
}: PolaroidProps) {
  return (
    <figure
      data-polaroid
      className={`relative mx-auto w-full max-w-md shadow-2xl ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        background: paper,
        color: ink,
      }}
    >
      <div className="p-3 pb-0 sm:p-4 sm:pb-0">
        <div
          className="relative aspect-square w-full overflow-hidden"
          style={{ background: photoBg }}
          data-polaroid-exposure
        >
          {photo}
        </div>
      </div>
      <figcaption
        className="px-5 pb-5 pt-4 text-center sm:px-6"
        style={{ transform: "rotate(-0.4deg)" }}
      >
        <span className="block text-xl italic tracking-wide">{role}</span>
        <span className="mt-1 block text-sm opacity-60">{note}</span>
      </figcaption>
    </figure>
  );
}
