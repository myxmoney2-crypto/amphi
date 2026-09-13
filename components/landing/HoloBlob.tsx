interface HoloBlobProps {
  className?: string;
  size?: number;
  variant?: "blob" | "ring" | "dot";
  color?: string;
}

/**
 * Élément décoratif flottant (bulle holographique dégradée, anneau ou point
 * plein). Réagit légèrement au survol (scale) pour donner un effet vivant —
 * combiner avec `animate-float`/`animate-floatSlow` via `className` pour le
 * mouvement continu.
 */
export default function HoloBlob({
  className = "",
  size = 260,
  variant = "blob",
  color = "#a78bfa",
}: HoloBlobProps) {
  const hover = "transition-transform duration-300 ease-out hover:scale-125";

  if (variant === "ring") {
    return (
      <div
        className={`${hover} ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: "9999px",
          border: `${Math.max(3, Math.round(size * 0.07))}px solid ${color}`,
          opacity: 0.55,
        }}
        aria-hidden="true"
      />
    );
  }

  if (variant === "dot") {
    return (
      <div
        className={`${hover} ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: "9999px",
          background: color,
          opacity: 0.75,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`${hover} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        background:
          "conic-gradient(from 210deg at 50% 50%, #ff9ecb, #ffd166, #7ee8fa, #a78bfa, #ff9ecb)",
        filter: "blur(2px) saturate(1.3)",
        boxShadow: "0 30px 80px -20px rgba(120, 100, 200, 0.45)",
        opacity: 0.9,
      }}
      aria-hidden="true"
    />
  );
}
