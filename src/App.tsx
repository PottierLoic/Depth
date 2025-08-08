import {useEffect, useRef, useState} from "react"
import { invoke } from '@tauri-apps/api/core'

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState("1.65")
  const [maxIterations, setMaxIterations] = useState(100)
  const [posRe, setPosRe] = useState("-0.6")
  const [posIm, setPosIm] = useState("0.0")

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)

  const canvasSize = 500

  useEffect(() => {
    async function syncState() {
      const [newZoom, newRe, newIm, newIter] = await Promise.all([
        invoke<string>("get_zoom"),
        invoke<string>("get_pos_re"),
        invoke<string>("get_pos_im"),
        invoke<number>("get_max_iterations"),
      ])

      setZoom(newZoom)
      setPosRe(newRe)
      setPosIm(newIm)
      setMaxIterations(newIter)
    }

    syncState()
  }, [])

  function handleMouseDown(e: React.MouseEvent) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setDragEnd(null)
    setIsDragging(true)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || !dragStart) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    setDragEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  async function handleMouseUp() {
    if (!dragStart || !dragEnd) return
    setIsDragging(false)

    const dx = Math.abs(dragEnd.x - dragStart.x)
    const dy = Math.abs(dragEnd.y - dragStart.y)
    const side = Math.max(dx, dy) * 2

    await invoke("zoom_into_box", {
      xPixel: Math.floor(dragStart.x),
      yPixel: Math.floor(dragStart.y),
      size: Math.max(1, Math.min(canvasSize, Math.floor(side))),
    })
    const [newZoom, newRe, newIm, newIter] = await Promise.all([
      invoke<string>("get_zoom"),
      invoke<string>("get_pos_re"),
      invoke<string>("get_pos_im"),
      invoke<number>("get_max_iterations"),
    ])

    setZoom(newZoom)
    setPosRe(newRe)
    setPosIm(newIm)
    setMaxIterations(newIter)

    await renderFractal()
  }

  async function renderFractal() {
    console.log("Starting render...")
    try {
      const response = await invoke<string>("render_frame", { width: canvasSize, height: canvasSize })
      const { pixels, width: w, height: h } = JSON.parse(response)

      const ctx = canvasRef.current?.getContext("2d")
      if (!ctx) return

      const imageData = new ImageData(Uint8ClampedArray.from(pixels), w, h)
      ctx.putImageData(imageData, 0, 0)

      console.log("Rendered frame")
    } catch (err) {
      console.error("Render failed:", err)
    }
  }
  return (
    <div className="flex w-full h-screen bg-white text-gray-800">
      <div className="flex flex-col items-center justify-center w-[550px] h-full gap-4 p-4">
        <div
          className="relative"
          style={{ width: canvasSize, height: canvasSize }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            className="block border border-gray-400"
            style={{ imageRendering: "pixelated" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
          {isDragging && dragStart && dragEnd && (() => {
            const dx = Math.abs(dragEnd.x - dragStart.x)
            const dy = Math.abs(dragEnd.y - dragStart.y)
            const halfSize = Math.max(dx, dy)
            const left = dragStart.x - halfSize
            const top = dragStart.y - halfSize
            const size = 2 * halfSize
            return (
              <div
                className="absolute border border-blue-400 bg-blue-300 bg-opacity-20"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${size}px`,
                  height: `${size}px`,
                  pointerEvents: "none",
                }}
              />
            )
          })()}
        </div>

        <div className="text-xs text-gray-600 mt-2 select-all">
          {posRe} + {posIm}i @ zoom {zoom}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6 w-[400px] bg-white shadow-lg">
        <h2 className="text-xl font-semibold">Fractal Settings</h2>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Zoom</label>
          <input
            type="text"
            value={zoom}
            onChange={e => setZoom(e.target.value)}
            onBlur={() => invoke("set_zoom", { zoom })}
            className="w-40 px-2 py-1 text-sm border rounded focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Iterations</label>
          <input
            type="number"
            value={maxIterations}
            onChange={e => setMaxIterations(parseInt(e.target.value))}
            onBlur={() => invoke("set_max_iterations", { maxIterations })}
            className="w-40 px-2 py-1 text-sm border rounded focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Position (Real)</label>
          <input
            type="text"
            value={posRe}
            onChange={e => setPosRe(e.target.value)}
            onBlur={() => invoke("set_pos_re", { posRe })}
            className="w-40 px-2 py-1 text-sm border rounded focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Position (Imaginary)</label>
          <input
            type="text"
            value={posIm}
            onChange={e => setPosIm(e.target.value)}
            onBlur={() => invoke("set_pos_im", { posIm })}
            className="w-40 px-2 py-1 text-sm border rounded focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <button
          className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
          onClick={renderFractal}
        >
          Render
        </button>
      </div>
    </div>
  )

}
