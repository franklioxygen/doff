import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { MouseEvent } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import type { ImageInfo, ImageCompareMode } from '../../store/sessionStore'
import { useI18n } from '../../i18n'
import pixelmatch from 'pixelmatch'

// ─── helpers ────────────────────────────────────────────────────────────────

const loadImageBitmap = (file: File): Promise<ImageBitmap> =>
  createImageBitmap(file)

const imageBitmapToDataUrl = (bmp: ImageBitmap): string => {
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  return c.toDataURL()
}

const fileToImageInfo = async (file: File): Promise<ImageInfo> => {
  const bitmap = await loadImageBitmap(file)
  return {
    name: file.name,
    width: bitmap.width,
    height: bitmap.height,
    size: file.size,
    dataUrl: imageBitmapToDataUrl(bitmap),
    bitmap,
  }
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const MATCH_OPTIONS = { threshold: 0.1 }
const DEFAULT_TRANSFORM = { tx: 0, ty: 0, scale: 1 }

const computeDiffPercent = (
  left: ImageBitmap,
  right: ImageBitmap,
): number => {
  const w = Math.max(left.width, right.width)
  const h = Math.max(left.height, right.height)
  const c1 = document.createElement('canvas')
  const c2 = document.createElement('canvas')
  c1.width = w; c1.height = h
  c2.width = w; c2.height = h
  const ctx1 = c1.getContext('2d')!
  const ctx2 = c2.getContext('2d')!
  ctx1.drawImage(left, 0, 0)
  ctx2.drawImage(right, 0, 0)
  const diff = document.createElement('canvas')
  diff.width = w; diff.height = h
  const outCtx = diff.getContext('2d')!
  const d1 = ctx1.getImageData(0, 0, w, h)
  const d2 = ctx2.getImageData(0, 0, w, h)
  const out = outCtx.createImageData(w, h)
  const numDiff = pixelmatch(d1.data, d2.data, out.data, w, h, MATCH_OPTIONS)
  return (numDiff / (w * h)) * 100
}

// ─── drop zone ───────────────────────────────────────────────────────────────

type DropZoneProps = {
  label: string
  image: ImageInfo | null
  onFile: (file: File | null) => void
  side: 'left' | 'right'
}

const DropZone = ({ label, image, onFile, side }: DropZoneProps) => {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) onFile(file)
    },
    [onFile],
  )

  return (
    <div className={`drop-zone ${dragging ? 'drop-zone-active' : ''} ${image ? 'drop-zone-filled' : ''}`}>
      {image ? (
        <div className="dz-preview">
          <img
            src={image.dataUrl}
            alt={side === 'left' ? t('images.leftPreviewAlt') : t('images.rightPreviewAlt')}
            className="dz-thumb"
          />
          <div className="dz-info">
            <span className="dz-name">{image.name}</span>
            <span className="dz-meta">
              {image.width}×{image.height} · {formatBytes(image.size)}
            </span>
          </div>
          <div className="dz-actions">
            <button type="button" onClick={() => inputRef.current?.click()}>
              {t('common.replace')}
            </button>
            <button type="button" onClick={() => onFile(null)}>
              {t('common.clear')}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="dz-empty"
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click() }}
          aria-label={t('images.dropZoneAria', { label })}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p>{t('images.dropHere')}</p>
          <span>{t('images.orClickBrowse')}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
          >
            {t('common.openFile')}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ─── viewer canvas with zoom/pan ─────────────────────────────────────────────

type ViewCanvasProps = {
  image: ImageInfo | null
  style?: React.CSSProperties
}

const ViewCanvas = ({ image, style }: ViewCanvasProps) => {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ tx: 0, ty: 0, scale: 1 })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')!
    canvas.width = image.width
    canvas.height = image.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(transform.scale, transform.scale)
    ctx.translate(transform.tx / transform.scale, transform.ty / transform.scale)
    ctx.drawImage(image.bitmap, 0, 0)
    ctx.restore()
  }, [image, transform])

  useEffect(() => {
    draw()
  }, [draw])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((prev) => {
      const newScale = Math.min(10, Math.max(0.1, prev.scale * factor))
      return { ...prev, scale: newScale }
    })
  }, [])

  // Pan
  const panRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null)

  const handleMouseDown = useCallback((e: MouseEvent) => {
    panRef.current = { startX: e.clientX, startY: e.clientY, startTx: transform.tx, startTy: transform.ty }
  }, [transform.tx, transform.ty])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!panRef.current) return
    const dx = e.clientX - panRef.current.startX
    const dy = e.clientY - panRef.current.startY
    setTransform((prev) => ({
      ...prev,
      tx: panRef.current!.startTx + dx,
      ty: panRef.current!.startTy + dy,
    }))
  }, [])

  const handleMouseUp = useCallback(() => { panRef.current = null }, [])

  return (
    <div
      ref={containerRef}
      className="view-canvas-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: image ? 'grab' : 'default', ...style }}
    >
      {image && (
        <div className="view-hint">{t('images.scrollZoomPan')}</div>
      )}
      <canvas ref={canvasRef} style={{ maxWidth: '100%', display: 'block' }} />
      {!image && <div className="view-empty">{t('images.noImage')}</div>}
    </div>
  )
}

// ─── diff canvas (pixel-level overlay) ──────────────────────────────────────

type DiffCanvasProps = {
  left: ImageInfo | null
  right: ImageInfo | null
  transform: { tx: number; ty: number; scale: number }
}

const DiffCanvas = ({ left, right, transform }: DiffCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !left || !right) return
    const w = Math.max(left.width, right.width)
    const h = Math.max(left.height, right.height)
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    const c1 = document.createElement('canvas')
    const c2 = document.createElement('canvas')
    c1.width = w; c1.height = h
    c2.width = w; c2.height = h
    c1.getContext('2d')!.drawImage(left.bitmap, 0, 0)
    c2.getContext('2d')!.drawImage(right.bitmap, 0, 0)
    const d1 = c1.getContext('2d')!.getImageData(0, 0, w, h)
    const d2 = c2.getContext('2d')!.getImageData(0, 0, w, h)
    const out = ctx.createImageData(w, h)
    pixelmatch(d1.data, d2.data, out.data, w, h, { threshold: 0.1 })
    ctx.putImageData(out, 0, 0)
  }, [left, right])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div className="view-canvas-container" style={{ cursor: 'default' }}>
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          display: 'block',
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  )
}

// ─── slider/fade overlay canvas ───────────────────────────────────────────────

type SliderCanvasProps = {
  left: ImageInfo | null
  right: ImageInfo | null
  sliderPct: number
  mode: ImageCompareMode
  transform: { tx: number; ty: number; scale: number }
}

const SliderCanvas = ({ left, right, sliderPct, mode, transform }: SliderCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !left || !right) return
    const w = Math.max(left.width, right.width)
    const h = Math.max(left.height, right.height)
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, w, h)

    if (mode === 'overlay') {
      ctx.globalAlpha = 0.5
      ctx.drawImage(left.bitmap, 0, 0)
      ctx.drawImage(right.bitmap, 0, 0)
      ctx.globalAlpha = 1
      return
    }

    const splitX = Math.round((sliderPct / 100) * w)

    if (mode === 'fade') {
      ctx.drawImage(left.bitmap, 0, 0)
      ctx.save()
      ctx.beginPath()
      ctx.rect(splitX, 0, w - splitX, h)
      ctx.clip()
      ctx.globalAlpha = sliderPct / 100
      ctx.drawImage(right.bitmap, 0, 0)
      ctx.restore()
      ctx.globalAlpha = 1
      // Draw a subtle crossfade indicator line
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(splitX, 0)
      ctx.lineTo(splitX, h)
      ctx.stroke()
      ctx.setLineDash([])
      return
    }

    // slider mode
    ctx.drawImage(left.bitmap, 0, 0)
    ctx.save()
    ctx.beginPath()
    ctx.rect(splitX, 0, w - splitX, h)
    ctx.clip()
    ctx.drawImage(right.bitmap, 0, 0)
    ctx.restore()

    // Slider line
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.moveTo(splitX, 0)
    ctx.lineTo(splitX, h)
    ctx.stroke()
    ctx.shadowBlur = 0

    // Slider handle
    const handleY = h / 2
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(splitX, handleY, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0d7a43'
    ctx.beginPath()
    ctx.arc(splitX, handleY, 9, 0, Math.PI * 2)
    ctx.fill()
    // Chevron
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(splitX - 4, handleY)
    ctx.lineTo(splitX + 4, handleY)
    ctx.stroke()
  }, [left, right, sliderPct, mode])

  useEffect(() => {
    draw()
  }, [draw])

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (mode === 'overlay') return
    setIsDragging(true)
    e.preventDefault()
  }, [mode])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || mode === 'overlay') return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.min(100, Math.max(0, (x / rect.width) * 100))
    // Dispatch a custom event so the parent can update sliderPct
    const event = new CustomEvent('slider-change', { detail: pct, bubbles: true })
    canvas.dispatchEvent(event)
  }, [isDragging, mode])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  return (
    <div
      ref={containerRef}
      className="view-canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: mode === 'overlay' ? 'default' : 'col-resize' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          display: 'block',
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export function ImageComparePage() {
  const imageSession = useSessionStore((s) => s.imageSession)
  const setImageSession = useSessionStore((s) => s.setImageSession)
  const clearImageSession = useSessionStore((s) => s.clearImageSession)
  const { t, formatNumber } = useI18n()

  const [diffPct, setDiffPct] = useState<number | null>(null)
  const [computing, setComputing] = useState(false)
  const [transform, setTransform] = useState(DEFAULT_TRANSFORM)

  const { leftImage, rightImage, mode, sliderPosition } = imageSession
  const modes: { id: ImageCompareMode; label: string }[] = [
    { id: 'slider', label: t('images.slider') },
    { id: 'fade', label: t('images.fade') },
    { id: 'overlay', label: t('images.overlay') },
    { id: 'diff', label: t('images.diffMask') },
  ]

  const handleFile = useCallback(
    async (side: 'left' | 'right', file: File | null) => {
      if (!file) {
        if (side === 'left') {
          setImageSession({ leftImage: null, diffPercent: null })
        } else {
          setImageSession({ rightImage: null, diffPercent: null })
        }
        setDiffPct(null)
        setComputing(false)
        setTransform(DEFAULT_TRANSFORM)
        return
      }

      try {
        const info = await fileToImageInfo(file)
        setImageSession({ [side === 'left' ? 'leftImage' : 'rightImage']: info, diffPercent: null })
        setDiffPct(null)
      } catch {
        // ignore
      }
    },
    [setImageSession],
  )

  const handleClearSession = useCallback(() => {
    clearImageSession()
    setDiffPct(null)
    setComputing(false)
    setTransform(DEFAULT_TRANSFORM)
  }, [clearImageSession])

  // Compute diff when both images are loaded
  useEffect(() => {
    if (!leftImage || !rightImage) return
    if (mode !== 'diff') return
    setComputing(true)
    const timeout = setTimeout(async () => {
      try {
        const pct = computeDiffPercent(leftImage.bitmap, rightImage.bitmap)
        setDiffPct(pct)
        setImageSession({ diffPercent: pct })
      } finally {
        setComputing(false)
      }
    }, 100)
    return () => clearTimeout(timeout)
  }, [leftImage, rightImage, mode, setImageSession])

  // Slider event listener
  useEffect(() => {
    const handleSlider = (e: Event) => {
      setImageSession({ sliderPosition: (e as CustomEvent<number>).detail })
    }
    window.addEventListener('slider-change', handleSlider)
    return () => window.removeEventListener('slider-change', handleSlider)
  }, [setImageSession])

  const bothLoaded = leftImage && rightImage

  const handleResetZoom = () => setTransform(DEFAULT_TRANSFORM)

  return (
    <div className="image-page">
      <div className="page-header">
        <h1>{t('images.title')}</h1>
        <div className="stat-pills">
          {diffPct !== null && (
            <span className="pill pill-changed">
              {t('images.diffPixels', {
                value: formatNumber(diffPct, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              })}
            </span>
          )}
          {computing && <span className="pill">{t('images.computingDiff')}</span>}
          {bothLoaded && (
            <>
              <span className="pill">
                {t('images.leftDimensions', { dimensions: `${leftImage!.width}×${leftImage!.height}` })}
              </span>
              <span className="pill">
                {t('images.rightDimensions', { dimensions: `${rightImage!.width}×${rightImage!.height}` })}
              </span>
              <span className="pill">
                {formatBytes(leftImage!.size)} · {formatBytes(rightImage!.size)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Drop zones */}
      <div className="image-dropzones">
        <DropZone
          label={t('images.leftImage')}
          image={leftImage}
          onFile={(f) => handleFile('left', f)}
          side="left"
        />
        <DropZone
          label={t('images.rightImage')}
          image={rightImage}
          onFile={(f) => handleFile('right', f)}
          side="right"
        />
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <span style={{ fontWeight: 500, marginRight: 4 }}>{t('common.mode')}:</span>
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              className={mode === m.id ? 'mode-active' : ''}
              onClick={() => setImageSession({ mode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="toolbar-group">
          {bothLoaded && mode !== 'diff' && (
            <button type="button" onClick={() => setImageSession({ mode: 'diff' })}>
              {t('images.computeDiffPercent')}
            </button>
          )}
          <button type="button" onClick={handleResetZoom}>{t('images.resetZoom')}</button>
          <button type="button" onClick={handleClearSession}>{t('images.clearSession')}</button>
        </div>
      </div>

      {/* Viewer area */}
      <div className="image-viewer-area">
        {!bothLoaded && (
          <div className="viewer-placeholder">
            <p>{t('images.loadTwoImages')}</p>
          </div>
        )}
        {bothLoaded && mode === 'diff' && (
          <DiffCanvas left={leftImage} right={rightImage} transform={transform} />
        )}
        {bothLoaded && mode !== 'diff' && (
          <SliderCanvas
            left={leftImage}
            right={rightImage}
            sliderPct={sliderPosition}
            mode={mode}
            transform={transform}
          />
        )}
      </div>

      {/* Per-image views for side-by-side reference */}
      {bothLoaded && (
        <div className="image-side-panels">
          <div className="side-panel">
            <h3>{leftImage!.name}</h3>
            <ViewCanvas image={leftImage} />
          </div>
          <div className="side-panel">
            <h3>{rightImage!.name}</h3>
            <ViewCanvas image={rightImage} />
          </div>
        </div>
      )}
    </div>
  )
}
