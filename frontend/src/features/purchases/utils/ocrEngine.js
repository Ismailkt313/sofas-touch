const MAX_OCR_PDF_PAGES = 3

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

export async function renderPdfPagesToImages(
  pdfFile,
  { maxPages = MAX_OCR_PDF_PAGES, scale = 2.0, onProgress } = {},
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
    ocrInputs = [file]
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
    let confidenceSum = 0

    for (let i = 0; i < ocrInputs.length; i += 1) {
      activePageIdx = i
      const result = await worker.recognize(ocrInputs[i])
      const text = String(result?.data?.text || '').trim()
      if (text) {
        pageTexts.push(text)
      }
      confidenceSum += Number(result?.data?.confidence || 0)
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
