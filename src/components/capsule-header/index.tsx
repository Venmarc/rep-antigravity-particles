import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";

/**
 * Capsule header: transparent and merged with the page at rest.
 * On scroll it detaches into a centered floating capsule.
 * Borderless everywhere; transform/opacity only.
 */
export function CapsuleHeader({ dark }: { dark?: boolean }) {
  const [detached, setDetached] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() =>
        setDetached(window.scrollY > 24),
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <header
      data-header="capsule"
      className="fixed inset-x-0 top-3 z-50 flex justify-center pointer-events-none"
    >
      <nav
        aria-label="Primary"
        className={`pointer-events-auto flex items-center gap-1 rounded-full px-2 py-2 transition-all duration-500 ${
          dark ? "text-[var(--ox-fg)]" : "text-[var(--sig-fg)]"
        } ${
          detached
            ? "opacity-100 translate-y-0 scale-100 backdrop-blur-xl"
            : "opacity-95 -translate-y-1 scale-[0.98] backdrop-blur-0"
        }`}
        style={{
          background: detached
            ? dark
              ? "rgba(20,20,28,0.55)"
              : "rgba(255,255,255,0.6)"
            : "transparent",
          boxShadow: detached ? "0 8px 40px rgba(0,0,0,0.18)" : "none",
          transitionProperty: "transform, opacity, background, box-shadow",
          transitionTimingFunction: "var(--ease-out)",
        }}
      >
        <HeaderLink to="/" dark={dark}>
          OX
        </HeaderLink>
        <HeaderLink to="/signal" dark={dark}>
          Signal
        </HeaderLink>
        <HeaderLink to="/playground" dark={dark}>
          Playground
        </HeaderLink>
      </nav>
    </header>
  );
}

function HeaderLink({
  to,
  children,
  dark,
}: {
  to: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `rounded-full px-4 py-1.5 text-sm transition-colors duration-300 ${
          isActive
            ? dark
              ? "bg-white/10"
              : "bg-black/[0.06]"
            : "hover:bg-black/[0.04]"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

/**
 * Alt header: borderless sticky that fades into the page (no capsule,
 * no bottom border). Content just sits on the page surface.
 */
export function FadeHeader() {
  return (
    <header
      data-header="fade"
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--pg-bg) 85%, transparent), transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
        maskImage: "linear-gradient(to bottom, black 55%, transparent)",
      }}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-[var(--pg-fg)]"
      >
        <Link to="/" className="text-sm font-semibold tracking-wide">
          ⌘ playground
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <FadeLink to="/">OX</FadeLink>
          <FadeLink to="/signal">Signal</FadeLink>
          <FadeLink to="/playground">Playground</FadeLink>
        </div>
      </nav>
    </header>
  );
}

function FadeLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className="opacity-70 transition-opacity duration-300 hover:opacity-100"
    >
      {children}
    </NavLink>
  );
}
