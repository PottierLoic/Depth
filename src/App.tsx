import { useEffect, useRef, useState } from "react"
import { invoke } from '@tauri-apps/api/core'

export default function Page() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1.0)
  const [iterations, setIterations] = useState(100)
  const [posRe, setPosRe] = useState("0.0")
  const [posIm, setPosIm] = useState("0.0")
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        setDimensions({ width: clientWidth, height: clientHeight })
      }
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  async function renderFractal(width: number, height: number) {
    console.log("Starting render...")

    try {
      const response = await invoke<string>("render_frame", { width, height })
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
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full block"
        style={{ imageRendering: "pixelated" }}
      />

      <div className="absolute top-4 right-4 w-80 bg-white bg-opacity-90 border border-gray-300 p-6 rounded-lg shadow-lg flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Fractal Settings</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700">Zoom</label>
          <input
            type="number"
            step="any"
            value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Iterations</label>
          <input
            type="number"
            value={iterations}
            onChange={e => setIterations(parseInt(e.target.value))}
            className="mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Position (Real)</label>
          <input
            type="text"
            value={posRe}
            onChange={e => setPosRe(e.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Position (Imaginary)</label>
          <input
            type="text"
            value={posIm}
            onChange={e => setPosIm(e.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          onClick={() => {
            renderFractal(dimensions.width, dimensions.height)
          }}
        >
          Render
        </button>
      </div>
    </div>
  )
}