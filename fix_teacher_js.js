const fs = require('fs');
let c = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/teacher.js', 'utf8');

const pdfCode = `
// ── Quran PDF Viewer ──────────────────────────────────────────────────────
const QURAN_PDF_URL = '/assets/Quranpdfhub-Arabic-Text-Quran.pdf';

document.getElementById('src-quran-pdf').addEventListener('click', () => {
  document.getElementById('source-menu').style.display = 'none';
  openQuranPDF();
});

let pdfDoc = null;
let pdfCurrentPage = 1;
let pdfRendering = false;
let pdfPendingPage = null;
let pdfDrawCtx = null;
let pdfIsDrawing = false;
let pdfLastX = 0, pdfLastY = 0;

function openQuranPDF() {
  const panel = document.getElementById('quran-pdf-panel');
  panel.style.display = 'flex';
  socket.emit('quran-open', { roomId });

  if (pdfDoc) { renderPDFPage(pdfCurrentPage); return; }

  // Load PDF.js from CDN if not already loaded
  if (!window.pdfjsLib) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      loadPDF();
    };
    document.head.appendChild(script);
  } else {
    loadPDF();
  }
}

function loadPDF() {
  showToast('Loading Quran PDF...', '#6096ff');
  pdfjsLib.getDocument(QURAN_PDF_URL).promise.then(pdf => {
    pdfDoc = pdf;
    document.getElementById('qpdf-total').textContent = '/ ' + pdf.numPages;
    document.getElementById('qpdf-page-input').max = pdf.numPages;
    renderPDFPage(pdfCurrentPage);
    setupPDFDrawCanvas();
  }).catch(e => {
    showToast('Failed to load PDF', '#ff6b6b');
    console.error('[pdf]', e);
  });
}

function renderPDFPage(num) {
  if (!pdfDoc) return;
  if (pdfRendering) { pdfPendingPage = num; return; }
  pdfRendering = true;
  pdfCurrentPage = num;
  document.getElementById('qpdf-page-input').value = num;

  pdfDoc.getPage(num).then(page => {
    const container = document.getElementById('qpdf-container');
    const scale = container.clientWidth / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: Math.max(scale, 0.8) });

    const pdfCanvas = document.getElementById('qpdf-canvas');
    pdfCanvas.width  = viewport.width;
    pdfCanvas.height = viewport.height;

    // Sync draw canvas size
    const dc = document.getElementById('qpdf-draw-canvas');
    dc.width  = viewport.width;
    dc.height = viewport.height;
    pdfDrawCtx = dc.getContext('2d');

    page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise.then(() => {
      pdfRendering = false;
      if (pdfPendingPage) { const p = pdfPendingPage; pdfPendingPage = null; renderPDFPage(p); }
    });
  });

  // Broadcast to students
  socket.emit('quran-sync', { roomId, page: num, scrollPercent: 0 });
}

function setupPDFDrawCanvas() {
  const dc = document.getElementById('qpdf-draw-canvas');
  if (dc._setup) return;
  dc._setup = true;

  const getPos = (e) => {
    const r = dc.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - r.left) / r.width,
      y: (src.clientY - r.top)  / r.height
    };
  };

  dc.addEventListener('mousedown', (e) => {
    if (!penActive) return;
    pdfIsDrawing = true;
    const p = getPos(e);
    pdfLastX = p.x; pdfLastY = p.y;
    pdfDrawCtx.beginPath();
    socket.emit('draw-begin', { roomId, x: p.x, y: p.y, color: penColor, width: penSize, pdfMode: true });
    e.preventDefault();
  });

  dc.addEventListener('mousemove', (e) => {
    if (!penActive || !pdfIsDrawing) return;
    const p = getPos(e);
    pdfDrawCtx.beginPath();
    pdfDrawCtx.moveTo(pdfLastX * dc.width, pdfLastY * dc.height);
    pdfDrawCtx.lineTo(p.x * dc.width, p.y * dc.height);
    pdfDrawCtx.strokeStyle = penColor;
    pdfDrawCtx.lineWidth = penSize;
    pdfDrawCtx.lineCap = pdfDrawCtx.lineJoin = 'round';
    pdfDrawCtx.stroke();
    socket.emit('draw', { roomId, x: p.x, y: p.y, color: penColor, width: penSize, pdfMode: true });
    pdfLastX = p.x; pdfLastY = p.y;
    e.preventDefault();
  });

  dc.addEventListener('mouseup',    () => { pdfIsDrawing = false; socket.emit('draw-end', { roomId }); });
  dc.addEventListener('mouseleave', () => { if (pdfIsDrawing) { pdfIsDrawing = false; socket.emit('draw-end', { roomId }); } });

  dc.addEventListener('touchstart', (e) => {
    if (!penActive) return;
    e.preventDefault();
    pdfIsDrawing = true;
    const p = getPos(e);
    pdfLastX = p.x; pdfLastY = p.y;
    socket.emit('draw-begin', { roomId, x: p.x, y: p.y, color: penColor, width: penSize, pdfMode: true });
  }, { passive: false });

  dc.addEventListener('touchmove', (e) => {
    if (!penActive || !pdfIsDrawing) return;
    e.preventDefault();
    const p = getPos(e);
    pdfDrawCtx.beginPath();
    pdfDrawCtx.moveTo(pdfLastX * dc.width, pdfLastY * dc.height);
    pdfDrawCtx.lineTo(p.x * dc.width, p.y * dc.height);
    pdfDrawCtx.strokeStyle = penColor;
    pdfDrawCtx.lineWidth = penSize;
    pdfDrawCtx.lineCap = pdfDrawCtx.lineJoin = 'round';
    pdfDrawCtx.stroke();
    socket.emit('draw', { roomId, x: p.x, y: p.y, color: penColor, width: penSize, pdfMode: true });
    pdfLastX = p.x; pdfLastY = p.y;
  }, { passive: false });

  dc.addEventListener('touchend', () => { pdfIsDrawing = false; socket.emit('draw-end', { roomId }); });
}

// PDF navigation controls
document.getElementById('qpdf-prev').addEventListener('click', () => {
  if (pdfCurrentPage > 1) renderPDFPage(pdfCurrentPage - 1);
});
document.getElementById('qpdf-next').addEventListener('click', () => {
  if (pdfDoc && pdfCurrentPage < pdfDoc.numPages) renderPDFPage(pdfCurrentPage + 1);
});
document.getElementById('qpdf-page-input').addEventListener('change', (e) => {
  const p = parseInt(e.target.value);
  if (pdfDoc && p >= 1 && p <= pdfDoc.numPages) renderPDFPage(p);
});
document.getElementById('qpdf-close').addEventListener('click', () => {
  document.getElementById('quran-pdf-panel').style.display = 'none';
  socket.emit('quran-close', { roomId });
});

// Clear PDF draw canvas when clear button is pressed
const origClearClick = btnClear.onclick;
btnClear.addEventListener('click', () => {
  if (pdfDrawCtx) pdfDrawCtx.clearRect(0, 0,
    document.getElementById('qpdf-draw-canvas').width,
    document.getElementById('qpdf-draw-canvas').height);
});

`;

// Insert before final console.log
const insertAt = c.lastIndexOf('console.log("[teacher] ready');
c = c.slice(0, insertAt) + pdfCode + c.slice(insertAt);
fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/teacher.js', c, 'utf8');
console.log('teacher.js updated');
