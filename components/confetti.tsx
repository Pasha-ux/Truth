"use client"

import { useEffect, useState } from "react"

interface ConfettiPiece {
  id: number
  x: number
  y: number
  color: string
  size: number
  rotation: number
  velocityX: number
  velocityY: number
}

interface ConfettiProps {
  originX: number
  originY: number
  active: boolean
  color: "green" | "red"
}

const COLORS_GREEN = ["#22c55e", "#16a34a", "#4ade80", "#a3e635", "#34d399"]
const COLORS_RED = ["#ef4444", "#dc2626", "#f87171", "#fb923c", "#f43f5e"]

export function Confetti({ originX, originY, active, color }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    if (!active) {
      setPieces([])
      return
    }

    const colors = color === "green" ? COLORS_GREEN : COLORS_RED
    const newPieces: ConfettiPiece[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: originX + (Math.random() - 0.5) * 40,
      y: originY,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      velocityX: (Math.random() - 0.5) * 12,
      velocityY: -(Math.random() * 10 + 5),
    }))
    setPieces(newPieces)

    const timer = setTimeout(() => setPieces([]), 1200)
    return () => clearTimeout(timer)
  }, [active, originX, originY, color])

  if (pieces.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall 1s ease-out forwards`,
            animationDelay: `${Math.random() * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}
