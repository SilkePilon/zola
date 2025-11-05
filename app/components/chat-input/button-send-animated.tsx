"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  MotionGrid,
  MotionGridCells,
  type Frames,
} from "@/components/animate-ui/primitives/animate/motion-grid"
// RotatingText is installed; we keep label hidden for compact circle button
// import { RotatingText, RotatingTextContainer } from "@/components/animate-ui/primitives/texts/rotating"

// Frames adapted from the requested reference snippet
const arrowUpFramesBase: Frames = [
  [[2, 4]],
  [
    [1, 4],
    [2, 4],
    [3, 4],
    [2, 3],
  ],
  [
    [2, 4],
    [1, 3],
    [2, 3],
    [3, 3],
    [2, 2],
  ],
  [
    [2, 4],
    [2, 3],
    [1, 2],
    [2, 2],
    [3, 2],
    [2, 1],
  ],
  [
    [2, 3],
    [2, 2],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 0],
  ],
  [
    [2, 2],
    [2, 1],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [2, 1],
    [2, 0],
  ],
  [[2, 0]],
  [],
]

// Insert a 1s pause on the frame where the arrow is most "complete" (max dots)
const withPauseAtMax = (frames: Frames, repeats: number): Frames => {
  let maxIdx = 0
  let maxLen = 0
  frames.forEach((f, i) => {
    if (f.length > maxLen) {
      maxLen = f.length
      maxIdx = i
    }
  })
  const paused: Frames = []
  frames.forEach((f, i) => {
    paused.push(f)
    if (i === maxIdx) {
      for (let r = 0; r < repeats - 1; r++) paused.push(f)
    }
  })
  return paused
}

// Create a simple crosshair sweep: vertical center from top->bottom, then horizontal center left->right
const buildCrosshairFrames = (): Frames => {
  const inBounds = (x: number, y: number) => x >= 0 && x < 5 && y >= 0 && y < 5
  const plusAt = (x: number, y: number) =>
    (
      [
        [x, y],
        [x, y - 1],
        [x, y + 1],
        [x - 1, y],
        [x + 1, y],
      ].filter(([px, py]) => inBounds(px, py)) as number[][]
    )

  // Move a plus-shaped crosshair along vertical then horizontal center lines
  const centers: [number, number][] = [
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [2, 2],
  ]

  const frames: number[][][] = []
  for (const [cx, cy] of centers) {
    frames.push(plusAt(cx, cy))
  }
  return frames as unknown as Frames
}

const idleCrosshairFrames = buildCrosshairFrames()

const busyFrames: Frames = [
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [4, 1],
    [4, 2],
    [4, 3],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 3],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [3, 4],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 3],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 1],
    [4, 1],
    [4, 2],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [3, 0],
    [4, 0],
    [4, 1],
    [4, 2],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 1],
    [4, 0],
    [4, 1],
    [4, 2],
  ],
]

export type SendButtonMode = "idle" | "typing" | "responding"

export function SendButtonIconAnimated({ mode }: { mode: SendButtonMode }) {
  const frames: Frames = useMemo(() => {
    if (mode === "typing") return withPauseAtMax(arrowUpFramesBase, 5)
    if (mode === "responding") return busyFrames
    return idleCrosshairFrames
  }, [mode])

  const [key, setKey] = useState(0)
  useEffect(() => setKey((k) => k + 1), [mode])

  return (
    <motion.div
      key={key}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center justify-center text-primary-foreground"
    >
      <MotionGrid
        gridSize={[5, 5]}
        frames={frames}
        duration={200}
        className="w-fit gap-[2px]"
        style={{ gridTemplateColumns: "repeat(5, 3px)", gridAutoRows: "3px" }}
      >
        <MotionGridCells className="size-[3px] aspect-square rounded-full bg-current opacity-30 data-[active=true]:opacity-90" />
      </MotionGrid>
    </motion.div>
  )
}
