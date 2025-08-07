import { useRef, useState } from "react"
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

  function getBox(start: { x: number; y: number }, end: { x: number; y: number }) {
    const size = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
    const x = start.x < end.x ? start.x : start.x - size
    const y = start.y < end.y ? start.y : start.y - size
    return { x, y, size }
  }

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

    const box = getBox(dragStart, dragEnd)

    await invoke("zoom_into_box", {
      width: canvasSize,
      height: canvasSize,
      startX: box.x,
      startY: box.y,
      size: box.size
    })

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
    <div className="flex justify-center items-center w-[550px] h-screen p-6 bg-white">
      <div className="relative" style={{ width: canvasSize, height: canvasSize }}>
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
        {isDragging && dragStart && dragEnd && (
          <div
            className="absolute border border-blue-400 bg-blue-300 bg-opacity-20"
            style={{
              left: `${getBox(dragStart, dragEnd).x}px`,
              top: `${getBox(dragStart, dragEnd).y}px`,
              width: `${getBox(dragStart, dragEnd).size}px`,
              height: `${getBox(dragStart, dragEnd).size}px`,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 p-6 w-[400px] bg-white border-l border-gray-300 shadow-lg">
        <h2 className="text-xl font-semibold">Fractal Settings</h2>
        <div>
          <label className="block text-sm font-medium">Zoom</label>
          <input
            type="number"
            step="any"
            value={zoom}
            onChange={e => setZoom(e.target.value)}
            onBlur={() => invoke("set_zoom", { zoom })}
            className="mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Iterations</label>
          <input
            type="number"
            value={maxIterations}
            onChange={e => setMaxIterations(parseInt(e.target.value))}
            onBlur={() => invoke("set_max_iterations", { maxIterations })}
            className="mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Position (Real)</label>
          <input
            type="text"
            value={posRe}
            onChange={e => setPosRe(e.target.value)}
            onBlur={() => invoke("set_pos_re", { posRe })}
            className="mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Position (Imaginary)</label>
          <input
            type="text"
            value={posIm}
            onChange={e => setPosIm(e.target.value)}
            onBlur={() => invoke("set_pos_im", { posIm })}
            className="mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          onClick={renderFractal}
        >
          Render
        </button>
      </div>
    </div>
  )
}
