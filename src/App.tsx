import { useRef, useState } from "react"
import { invoke } from '@tauri-apps/api/core'

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState("1.65")
  const [maxIterations, setMaxIterations] = useState(100)
  const [posRe, setPosRe] = useState("-0.6")
  const [posIm, setPosIm] = useState("0.0")

  const canvasSize = 500

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
    <div className="flex w-full h-screen overflow-hidden bg-white text-gray-800">
      {/* Left side with padding and white background */}
      <div className="flex justify-center items-center w-[550px] h-screen p-6 bg-white">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="block border border-gray-400"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {/* Control panel */}
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
