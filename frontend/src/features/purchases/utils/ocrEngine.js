const MAX_OCR_PDF_PAGES = 3
const MIN_IDEAL_IMAGE_WIDTH = 1500
const MAX_PREPROCESSED_DIMENSION = 2400

function resolveLocalOcrBaseHref() {
  if (globalThis.__STS_OCR_BASE_HREF__) {
    return String(globalThis.__STS_OCR_BASE_HREF__).replace(/\/$/, '')
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const rawBase =
      typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
        ? import.meta.env.BASE_URL
        : '/'
    const normalizedBase = String(rawBase).endsWith('/')
      ? String(rawBase)
      : `${rawBase}/`
    return new URL(`${normalizedBase}ocr`, window.location.origin).href.replace(
      /\/$/,
      '',
    )
  }

  return '/ocr'
}

function computeMedian(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function isBorderNoiseGlyph(text, width, height) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    return true
  }
  if (/^[|¦│┃┆┊!]+$/.test(trimmed)) {
    return true
  }
  if ((trimmed === '[' || trimmed === ']') && height > width * 3) {
    return true
  }
  return false
}

export function parseTesseractTsv(tsvText, pageIndex = 0) {
  if (typeof tsvText !== 'string' || !tsvText.trim()) {
    return { words: [], pageWidth: 0, pageHeight: 0 }
  }

  const lines = tsvText.replace(/\r\n?/g, '\n').split('\n')
  const words = []
  let pageWidth = 0
  let pageHeight = 0

  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i]
    if (!rawLine) {
      continue
    }
    const cols = rawLine.split('\t')
    if (cols.length < 12) {
      continue
    }

    const level = Number(cols[0])
    const blockNum = Number(cols[2]) || 0
    const parNum = Number(cols[3]) || 0
    const lineNum = Number(cols[4]) || 0
    const wordNum = Number(cols[5]) || 0
    const left = Number(cols[6]) || 0
    const top = Number(cols[7]) || 0
    const width = Number(cols[8]) || 0
    const height = Number(cols[9]) || 0
    const confidence = Number(cols[10])
    const text = cols.slice(11).join(' ').trim()

    if (level === 1) {
      pageWidth = Math.max(pageWidth, left + width)
      pageHeight = Math.max(pageHeight, top + height)
      continue
    }

    if (level !== 5 || !text) {
      continue
    }

    if (isBorderNoiseGlyph(text, width, height)) {
      continue
    }

    const right = left + Math.max(1, width)
    const bottom = top + Math.max(1, height)
    pageWidth = Math.max(pageWidth, right)
    pageHeight = Math.max(pageHeight, bottom)

    words.push({
      text,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      left,
      top,
      width: Math.max(1, width),
      height: Math.max(1, height),
      right,
      bottom,
      centerX: left + Math.max(1, width) / 2,
      centerY: top + Math.max(1, height) / 2,
      pageIndex,
      blockNum,
      parNum,
      lineNum,
      wordNum,
    })
  }

  return { words, pageWidth, pageHeight }
}

export function extractWordsFromBlocks(blocks, pageIndex = 0) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { words: [], pageWidth: 0, pageHeight: 0 }
  }

  const words = []
  let pageWidth = 0
  let pageHeight = 0

  blocks.forEach((block, bIdx) => {
    const paragraphs = Array.isArray(block?.paragraphs) ? block.paragraphs : []
    paragraphs.forEach((par, pIdx) => {
      const lines = Array.isArray(par?.lines) ? par.lines : []
      lines.forEach((line, lIdx) => {
        const lineWords = Array.isArray(line?.words) ? line.words : []
        lineWords.forEach((word, wIdx) => {
          const text = String(word?.text || '').trim()
          const bbox = word?.bbox || {}
          const left = Number(bbox.x0) || 0
          const top = Number(bbox.y0) || 0
          const right = Number(bbox.x1) || left + 1
          const bottom = Number(bbox.y1) || top + 1
          const width = Math.max(1, right - left)
          const height = Math.max(1, bottom - top)

          if (!text || isBorderNoiseGlyph(text, width, height)) {
            return
          }

          pageWidth = Math.max(pageWidth, right)
          pageHeight = Math.max(pageHeight, bottom)

          words.push({
            text,
            confidence: Number.isFinite(Number(word?.confidence))
              ? Number(word.confidence)
              : 0,
            left,
            top,
            width,
            height,
            right,
            bottom,
            centerX: left + width / 2,
            centerY: top + height / 2,
            pageIndex,
            blockNum: bIdx + 1,
            parNum: pIdx + 1,
            lineNum: lIdx + 1,
            wordNum: wIdx + 1,
          })
        })
      })
    })
  })

  return { words, pageWidth, pageHeight }
}

export function buildSpatialRowsFromWords(wordsInput, pageIndex = 0) {
  const words = Array.isArray(wordsInput)
    ? wordsInput
    : Array.isArray(wordsInput?.words)
      ? wordsInput.words
      : []
  if (words.length === 0) {
    return []
  }

  const heights = words.map((w) => w.height).filter((h) => h > 0)
  const medianHeight = Math.max(8, computeMedian(heights) || 14)
  const yMergeTolerance = Math.max(6, medianHeight * 0.55)

  const charWidths = words
    .filter((w) => w.text.length > 0 && w.width > 0)
    .map((w) => w.width / w.text.length)
  const medianCharWidth = Math.max(5, computeMedian(charWidths) || 8)
  const cellGapThreshold = Math.max(14, medianCharWidth * 2.15)

  const sortedByY = [...words].sort((a, b) => {
    if (Math.abs(a.centerY - b.centerY) <= 3) {
      return a.left - b.left
    }
    return a.centerY - b.centerY
  })

  const clusters = []

  for (const word of sortedByY) {
    let bestCluster = null
    let bestDelta = Infinity

    for (let i = clusters.length - 1; i >= 0; i -= 1) {
      const cluster = clusters[i]
      if (word.centerY - cluster.meanCenterY > yMergeTolerance * 2.2) {
        break
      }

      const deltaY = Math.abs(word.centerY - cluster.meanCenterY)
      const verticalOverlap =
        Math.min(word.bottom, cluster.bottom) - Math.max(word.top, cluster.top)
      const minHeight = Math.max(1, Math.min(word.height, cluster.medianHeight))

      if (
        (deltaY <= yMergeTolerance || verticalOverlap >= minHeight * 0.45) &&
        deltaY < bestDelta
      ) {
        bestCluster = cluster
        bestDelta = deltaY
      }
    }

    if (bestCluster) {
      bestCluster.words.push(word)
      const count = bestCluster.words.length
      bestCluster.meanCenterY =
        (bestCluster.meanCenterY * (count - 1) + word.centerY) / count
      bestCluster.top = Math.min(bestCluster.top, word.top)
      bestCluster.bottom = Math.max(bestCluster.bottom, word.bottom)
    } else {
      clusters.push({
        words: [word],
        meanCenterY: word.centerY,
        top: word.top,
        bottom: word.bottom,
        medianHeight: word.height || medianHeight,
      })
    }
  }

  clusters.sort((a, b) => a.meanCenterY - b.meanCenterY)

  return clusters.map((cluster, rowIdx) => {
    const rowWords = [...cluster.words].sort((a, b) => a.left - b.left)
    const cells = []

    for (const word of rowWords) {
      const prevCell = cells[cells.length - 1]
      if (!prevCell) {
        cells.push({
          words: [word],
          text: word.text,
          x0: word.left,
          x1: word.right,
          y0: word.top,
          y1: word.bottom,
          confidenceSum: word.confidence,
        })
        continue
      }

      const gap = word.left - prevCell.x1
      if (gap > cellGapThreshold) {
        cells.push({
          words: [word],
          text: word.text,
          x0: word.left,
          x1: word.right,
          y0: word.top,
          y1: word.bottom,
          confidenceSum: word.confidence,
        })
      } else {
        prevCell.words.push(word)
        prevCell.text = `${prevCell.text} ${word.text}`.trim()
        prevCell.x1 = Math.max(prevCell.x1, word.right)
        prevCell.y0 = Math.min(prevCell.y0, word.top)
        prevCell.y1 = Math.max(prevCell.y1, word.bottom)
        prevCell.confidenceSum += word.confidence
      }
    }

    const normalizedCells = cells.map((cell) => ({
      text: cell.text,
      x0: cell.x0,
      x1: cell.x1,
      y0: cell.y0,
      y1: cell.y1,
      centerX: (cell.x0 + cell.x1) / 2,
      width: Math.max(1, cell.x1 - cell.x0),
      confidence:
        cell.words.length > 0
          ? Math.round(cell.confidenceSum / cell.words.length)
          : 0,
      words: cell.words,
    }))

    const left = rowWords[0]?.left ?? 0
    const right = rowWords.reduce((maxR, w) => Math.max(maxR, w.right), 0)

    return {
      pageIndex,
      rowIndex: rowIdx,
      hasRealCoordinates: true,
      top: cluster.top,
      bottom: cluster.bottom,
      left,
      right,
      height: Math.max(1, cluster.bottom - cluster.top),
      centerY: cluster.meanCenterY,
      words: rowWords,
      cells: normalizedCells,
      text: normalizedCells.map((c) => c.text).join('   '),
    }
  })
}

async function prepareImageForBrowserOcr(imageSource) {
  if (
    typeof document === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined' ||
    typeof Blob === 'undefined' ||
    !(imageSource instanceof Blob)
  ) {
    return imageSource
  }

  if (typeof createImageBitmap !== 'function') {
    return imageSource
  }

  let bitmap = null
  try {
    bitmap = await createImageBitmap(imageSource)
    const srcW = bitmap.width
    const srcH = bitmap.height
    if (!srcW || !srcH) {
      return imageSource
    }

    let scale = 1
    if (srcW < MIN_IDEAL_IMAGE_WIDTH) {
      scale = Math.min(2, MIN_IDEAL_IMAGE_WIDTH / srcW)
    }
    const maxDim = Math.max(srcW * scale, srcH * scale)
    if (maxDim > MAX_PREPROCESSED_DIMENSION) {
      scale *= MAX_PREPROCESSED_DIMENSION / maxDim
    }

    const targetW = Math.max(1, Math.round(srcW * scale))
    const targetH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return imageSource
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    const imgData = ctx.getImageData(0, 0, targetW, targetH)
    const data = imgData.data
    let lumMin = 255
    let lumMax = 0

    for (let i = 0; i < data.length; i += 16) {
      const lum =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (lum < lumMin) lumMin = lum
      if (lum > lumMax) lumMax = lum
    }

    const dynamicRange = lumMax - lumMin
    if (dynamicRange >= 25 && dynamicRange < 235) {
      const span = Math.max(1, dynamicRange)
      for (let i = 0; i < data.length; i += 4) {
        const lum =
          0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        const stretched = Math.max(
          0,
          Math.min(255, Math.round(((lum - lumMin) / span) * 255)),
        )
        const cleaned = stretched > 232 ? 255 : stretched
        data[i] = cleaned
        data[i + 1] = cleaned
        data[i + 2] = cleaned
      }
      ctx.putImageData(imgData, 0, 0)
    }

    return canvas.toDataURL('image/png')
  } catch {
    return imageSource
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close()
    }
  }
}

export async function renderPdfPagesToImages(
  pdfFile,
  { maxPages = MAX_OCR_PDF_PAGES, scale = 2.25, onProgress } = {},
) {
  const pdfjsLib = await import('pdfjs-dist')
  const ocrBaseHref = resolveLocalOcrBaseHref()
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    globalThis.__STS_PDF_WORKER_SRC__ || `${ocrBaseHref}/pdf.worker.min.mjs`

  const arrayBuffer = await pdfFile.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  })

  const pdfDoc = await loadingTask.promise
  const totalPages = pdfDoc.numPages
  const pagesToRender = Math.min(totalPages, maxPages)
  const renderedPages = []

  for (let pageNum = 1; pageNum <= pagesToRender; pageNum += 1) {
    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'pdf_render',
        percent: Math.round(((pageNum - 1) / pagesToRender) * 25),
        message: `Rendering PDF page ${pageNum} of ${pagesToRender}...`,
      })
    }

    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise

    const dataUrl = canvas.toDataURL('image/png')
    renderedPages.push({
      pageNumber: pageNum,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    })
  }

  if (typeof pdfDoc.cleanup === 'function') {
    await pdfDoc.cleanup()
  }
  if (typeof loadingTask.destroy === 'function') {
    await loadingTask.destroy()
  }

  return {
    totalPages,
    renderedPagesCount: pagesToRender,
    pages: renderedPages,
  }
}

export async function extractBillTextLocally(file, { onProgress } = {}) {
  if (!file) {
    throw new Error('Select a bill image or PDF document first.')
  }

  const isPdf =
    String(file.type || '').toLowerCase() === 'application/pdf' ||
    /\.pdf$/i.test(String(file.name || ''))

  let ocrInputs
  let previewDataUrl = null
  let pdfMeta = null

  if (isPdf) {
    const rendered = await renderPdfPagesToImages(file, {
      maxPages: MAX_OCR_PDF_PAGES,
      onProgress,
    })
    if (!rendered.pages.length) {
      throw new Error('The selected PDF has no renderable pages.')
    }
    ocrInputs = rendered.pages.map((p) => p.dataUrl)
    previewDataUrl = rendered.pages[0].dataUrl
    pdfMeta = {
      totalPages: rendered.totalPages,
      scannedPages: rendered.renderedPagesCount,
    }
  } else {
    const prepared = await prepareImageForBrowserOcr(file)
    ocrInputs = [prepared]
  }

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'ocr_init',
      percent: isPdf ? 28 : 10,
      message: 'Initializing local OCR engine...',
    })
  }

  const { createWorker } = await import('tesseract.js')
  const ocrBaseHref = resolveLocalOcrBaseHref()
  const isNodeRuntime = Boolean(globalThis.process?.versions?.node)

  let activePageIdx = 0
  const totalOcrPages = ocrInputs.length
  const basePercent = isPdf ? 30 : 15

  const workerOptions = {
    langPath: ocrBaseHref,
    gzip: true,
    errorHandler: () => {},
    logger: (msg) => {
      if (
        typeof onProgress === 'function' &&
        msg &&
        msg.status === 'recognizing text' &&
        typeof msg.progress === 'number'
      ) {
        const perPageSpan = (92 - basePercent) / Math.max(1, totalOcrPages)
        const computed = Math.min(
          94,
          Math.round(
            basePercent +
              activePageIdx * perPageSpan +
              msg.progress * perPageSpan,
          ),
        )
        onProgress({
          stage: 'ocr_recognizing',
          percent: computed,
          message:
            totalOcrPages > 1
              ? `Reading text on page ${activePageIdx + 1} of ${totalOcrPages} (${Math.round(msg.progress * 100)}%)...`
              : `Extracting bill text locally (${Math.round(msg.progress * 100)}%)...`,
        })
      }
    },
  }

  if (!isNodeRuntime) {
    workerOptions.workerPath = `${ocrBaseHref}/worker.min.js`
    workerOptions.corePath = `${ocrBaseHref}/tesseract-core-lstm.wasm.js`
  } else {
    workerOptions.cacheMethod = 'none'
  }

  const worker = await createWorker('eng', 1, workerOptions)

  try {
    const pageTexts = []
    const pageTsvs = []
    const pageBlocks = []
    const pages = []
    let confidenceSum = 0

    for (let i = 0; i < ocrInputs.length; i += 1) {
      activePageIdx = i
      const result = await worker.recognize(
        ocrInputs[i],
        { preserve_interword_spaces: '1' },
        { text: true, blocks: true, tsv: true },
      )

      const data = result?.data || {}
      const rawPageText = String(data.text || '').trim()
      const pageTsv = typeof data.tsv === 'string' ? data.tsv : ''
      const blocks = Array.isArray(data.blocks) ? data.blocks : []

      let parsedSpatial = parseTesseractTsv(pageTsv, i)
      if (parsedSpatial.words.length === 0 && blocks.length > 0) {
        parsedSpatial = extractWordsFromBlocks(blocks, i)
      }

      const spatialRows = buildSpatialRowsFromWords(parsedSpatial.words, i)
      const reconstructedPageText =
        spatialRows.length > 0
          ? spatialRows.map((r) => r.text).join('\n')
          : rawPageText

      if (reconstructedPageText) {
        pageTexts.push(reconstructedPageText)
      }
      if (pageTsv) {
        pageTsvs.push(pageTsv)
      }
      if (blocks.length > 0) {
        pageBlocks.push(...blocks)
      }

      const pageConfidence = Number(data.confidence || 0)
      confidenceSum += pageConfidence

      pages.push({
        pageNumber: i + 1,
        width: parsedSpatial.pageWidth,
        height: parsedSpatial.pageHeight,
        confidence: Math.round(pageConfidence),
        text: reconstructedPageText,
        rawText: rawPageText,
        tsv: pageTsv,
        words: parsedSpatial.words,
        spatialRows,
      })
    }

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'ocr_done',
        percent: 100,
        message: 'Text extraction complete. Review extracted fields below.',
      })
    }

    return {
      rawText: pageTexts.join('\n\n'),
      tsv: pageTsvs.join('\n'),
      blocks: pageBlocks,
      pages,
      averageConfidence:
        ocrInputs.length > 0
          ? Math.round(confidenceSum / ocrInputs.length)
          : 0,
      previewDataUrl,
      pdfMeta,
    }
  } finally {
    await worker.terminate()
  }
}
