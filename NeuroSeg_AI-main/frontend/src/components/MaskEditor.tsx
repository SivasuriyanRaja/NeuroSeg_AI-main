import { useEffect, useRef, useState, useCallback } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { Undo, Redo, Eraser, Brush, Save, X, RotateCcw } from 'lucide-react'

interface MaskEditorProps {
  imageUrl: string
  initialMaskUrl: string | null
  onSave: (blob: Blob, notes: string) => Promise<void>
  onCancel: () => void
}

export default function MaskEditor({ imageUrl, initialMaskUrl, onSave, onCancel }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 })
  const [mode, setMode] = useState<'brush' | 'erase'>('brush')
  const [brushSize, setBrushSize] = useState(10)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isPanningEnabled, setIsPanningEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('Manual mask revision')
  
  // Undo/Redo stacks
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyStep, setHistoryStep] = useState(-1)

  // 1. Load image to get dimensions
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setDimensions({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = imageUrl
  }, [imageUrl])

  // 2. Initialize canvas with existing mask
  useEffect(() => {
    if (dimensions.w === 0) return
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    
    cvs.width = dimensions.w
    cvs.height = dimensions.h
    
    const initEmpty = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height)
      saveState(ctx, cvs)
    }

    if (initialMaskUrl) {
      const maskImg = new Image()
      maskImg.crossOrigin = 'anonymous'
      maskImg.onload = () => {
        ctx.clearRect(0, 0, cvs.width, cvs.height)
        ctx.drawImage(maskImg, 0, 0, cvs.width, cvs.height)
        saveState(ctx, cvs)
      }
      maskImg.onerror = () => initEmpty()
      maskImg.src = initialMaskUrl
    } else {
      initEmpty()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, initialMaskUrl])

  const saveState = (ctx: CanvasRenderingContext2D, cvs: HTMLCanvasElement) => {
    const data = ctx.getImageData(0, 0, cvs.width, cvs.height)
    setHistory(prev => {
      const newHistory = prev.slice(0, historyStep + 1)
      newHistory.push(data)
      return newHistory
    })
    setHistoryStep(prev => prev + 1)
  }

  const undo = () => {
    if (historyStep > 0) {
      const step = historyStep - 1
      setHistoryStep(step)
      const ctx = canvasRef.current?.getContext('2d')
      ctx?.putImageData(history[step], 0, 0)
    }
  }

  const redo = () => {
    if (historyStep < history.length - 1) {
      const step = historyStep + 1
      setHistoryStep(step)
      const ctx = canvasRef.current?.getContext('2d')
      ctx?.putImageData(history[step], 0, 0)
    }
  }

  // Drawing handlers
  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current
    if (!cvs) return null
    const rect = cvs.getBoundingClientRect()
    const scaleX = cvs.width / rect.width
    const scaleY = cvs.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningEnabled) return
    const coords = getCoords(e)
    if (!coords) return
    setIsDrawing(true)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    draw(e)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isPanningEnabled) return
    const coords = getCoords(e)
    if (!coords) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brushSize

    if (mode === 'brush') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)' // draw solid white
    } else {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0, 0, 0, 1)'
    }

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const cvs = canvasRef.current
    const ctx = cvs?.getContext('2d')
    if (cvs && ctx) saveState(ctx, cvs)
  }

  const handleSave = () => {
    const cvs = canvasRef.current
    if (!cvs) return
    
    // We need to ensure the mask is binary (black/white) and not anti-aliased grey
    // But since it's just saved as a PNG with alpha, drawing solid white is fine.
    // However, our dataset loader expects a grayscale mask. 
    // Let's draw a new solid black background canvas and paste the white mask over it.
    const exportCvs = document.createElement('canvas')
    exportCvs.width = cvs.width
    exportCvs.height = cvs.height
    const eCtx = exportCvs.getContext('2d')
    if (!eCtx) return
    eCtx.fillStyle = 'black'
    eCtx.fillRect(0, 0, exportCvs.width, exportCvs.height)
    eCtx.drawImage(cvs, 0, 0) // The transparent parts remain black, the white strokes remain white.
    
    setSaving(true)
    exportCvs.toBlob(blob => {
      if (blob) {
        onSave(blob, notes).finally(() => setSaving(false))
      } else {
        setSaving(false)
      }
    }, 'image/png')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
      {/* Editor Toolbar */}
      <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.8)',
        borderBottom: '1px solid var(--navy-800)', display: 'flex', gap: 16, alignItems: 'center' }}>
        
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-sm ${mode === 'brush' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setMode('brush'); setIsPanningEnabled(false) }} title="Brush">
            <Brush size={14} /> Brush
          </button>
          <button className={`btn btn-sm ${mode === 'erase' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setMode('erase'); setIsPanningEnabled(false) }} title="Eraser">
            <Eraser size={14} /> Erase
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>Size: {brushSize}</span>
          <input type="range" className="slider" min={2} max={100} step={2}
            value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} />
        </div>

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button className={`btn btn-sm ${isPanningEnabled ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setIsPanningEnabled(!isPanningEnabled)} title="Toggle Pan Mode">
            Pan Mode {isPanningEnabled ? '(ON)' : '(OFF)'}
          </button>
          <div style={{ width: 1, background: 'var(--navy-700)', margin: '0 8px' }} />
          <button className="btn btn-ghost btn-sm" onClick={undo} disabled={historyStep <= 0}>
            <Undo size={14} /> Undo
          </button>
          <button className="btn btn-ghost btn-sm" onClick={redo} disabled={historyStep >= history.length - 1}>
            <Redo size={14} /> Redo
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }}>
        {dimensions.w > 0 ? (
          <TransformWrapper
            initialScale={1}
            minScale={0.1}
            maxScale={10}
            centerOnInit
            panning={{ disabled: !isPanningEnabled }}
          >
            {({ resetTransform }) => (
              <>
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => resetTransform()}>
                    <RotateCcw size={13} /> Reset View
                  </button>
                </div>
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                  <div style={{ position: 'relative', width: dimensions.w, height: dimensions.h,
                    maxWidth: '100%', maxHeight: '100%' /* Let it shrink to fit initially if needed */ }}>
                    {/* Underlying image */}
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="original"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                      draggable={false}
                    />
                    {/* Drawing canvas */}
                    <canvas
                      ref={canvasRef}
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        cursor: isPanningEnabled ? 'grab' : 'crosshair',
                        opacity: 0.6,
                        objectFit: 'contain',
                        touchAction: 'none'
                      }}
                      onPointerDown={startDrawing}
                      onPointerMove={draw}
                      onPointerUp={stopDrawing}
                      onPointerOut={stopDrawing}
                    />
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        ) : (
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        )}
      </div>

      {/* Footer / Save */}
      <div style={{ padding: '12px 16px', background: 'var(--navy-900)',
        borderTop: '1px solid var(--navy-800)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <input 
          className="input" 
          style={{ flex: 1 }} 
          placeholder="Revision notes..." 
          value={notes} 
          onChange={e => setNotes(e.target.value)} 
        />
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          <X size={16} /> Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <div className="spinner" /> : <Save size={16} />} Save Revision
        </button>
      </div>
    </div>
  )
}
