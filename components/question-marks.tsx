"use client"

const marks = [
  { x: 5, y: 8, size: 60, color: "#2d8a4e", delay: 0, duration: 4.2 },
  { x: 18, y: 15, size: 50, color: "#b92d3a", delay: 0.8, duration: 3.8 },
  { x: 35, y: 6, size: 55, color: "#2d8a4e", delay: 1.5, duration: 4.5 },
  { x: 55, y: 10, size: 48, color: "#b92d3a", delay: 0.3, duration: 3.6 },
  { x: 75, y: 5, size: 65, color: "#2d8a4e", delay: 2.0, duration: 4.0 },
  { x: 90, y: 12, size: 58, color: "#b92d3a", delay: 1.2, duration: 4.3 },
  { x: 8, y: 75, size: 52, color: "#2d8a4e", delay: 0.6, duration: 3.9 },
  { x: 25, y: 82, size: 45, color: "#b92d3a", delay: 1.8, duration: 4.1 },
  { x: 70, y: 78, size: 60, color: "#2d8a4e", delay: 0.4, duration: 3.7 },
  { x: 88, y: 70, size: 68, color: "#b92d3a", delay: 1.0, duration: 4.4 },
  { x: 45, y: 80, size: 42, color: "#2d8a4e", delay: 2.2, duration: 3.5 },
  { x: 92, y: 45, size: 55, color: "#b92d3a", delay: 1.6, duration: 4.2 },
]

export function QuestionMarks() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
      {marks.map((m, i) => (
        <span
          key={i}
          className="absolute animate-float select-none"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            fontSize: `${m.size}px`,
            color: m.color,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
            fontWeight: 900,
            fontFamily: "serif",
            textShadow: `0 0 10px ${m.color}44, 0 2px 4px rgba(0,0,0,0.5)`,
            opacity: 0.7,
          }}
        >
          ?
        </span>
      ))}
    </div>
  )
}
