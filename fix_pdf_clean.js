const fs = require('fs');
let c = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', 'utf8');

const pdfStart = c.indexOf('// ── Quran PDF Viewer (student');
const pdfEnd   = c.indexOf('console.log("[student] ready');

const newPdfSection = `// ── Quran PDF Viewer (student - synced from teacher) ──────────────────────
const QURAN_PDF_URL = '/assets/Quranpdfhub-Arabic-Text-Quran.pdf';
let sPdfDoc = null;
let sPdfCurrentPage = 1;
let sPdfRendering = false;
let sPdfPendingPage = null;
let sPdfDrawCtx = null;

function getPdfDrawCtx() {
  if (sPdfDrawCtx) return sPdfDrawCtx;
  const el = document.getElementById('qpdf-draw-canvas');
  if (el && el.width > 0) { sPdfDrawCtx = el.getContext('2d'); return sPdfDrawCtx; }
  return null;
}

function loadStudentPDF(callback) {
  if (sPdfDoc) { if (callback) callback(); return; }
  const loadDoc = () => {
    pdfjsLib.getDocument(QURAN_PDF_URL).promise.then(pdf => {
      sPdfDoc = pdf;
      const tot = document.getElementById('qpdf-total');
      if (tot) tot.textContent = '/ ' + pdf.numPages;
      if (callback) callback();
    }).catch(e => console.error('[pdf student]', e));
  };
  if (!window.pdfjsLib) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      loadDoc();
    };
    document.head.appendChild(script);
  } else { loadDoc(); }
}

function renderStudentPDFPage(num) {
  if (!sPdfDoc) { loadStudentPDF(() => renderStudentPDFPage(num)); return; }
  if (sPdfRendering) { sPdfPendingPage = num; return; }
  sPdfRendering = true;
  sPdfCurrentPage = num;
  const lbl = document.getElementById('qpdf-page-label');
  if (lbl) lbl.textContent = 'Page ' + num;
  sPdfDoc.getPage(num).then(page => {
    const container = document.getElementById('qpdf-container');
    const scale = container.clientWidth / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: Math.max(scale, 0.8) });
    const pdfCanvas = document.getElementById('qpdf-canvas');
    pdfCanvas.width  = viewport.width;
    pdfCanvas.height = viewport.height;
    const drawEl = document.getElementById('qpdf-draw-canvas');
    drawEl.width  = viewport.width;
    drawEl.height = viewport.height;
    sPdfDrawCtx = drawEl.getContext('2d');
    page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise.then(() => {
      sPdfRendering = false;
      if (sPdfPendingPage) { const p = sPdfPendingPage; sPdfPendingPage = null; renderStudentPDFPage(p); }
    });
  });
}

socket.on('quran-open', () => {
  const panel = document.getElementById('quran-pdf-panel');
  if (panel) { panel.style.display = 'flex'; loadStudentPDF(() => renderStudentPDFPage(sPdfCurrentPage)); }
});

socket.on('quran-close', () => {
  const panel = document.getElementById('quran-pdf-panel');
  if (panel) panel.style.display = 'none';
});

socket.on('quran-sync', ({ page, scrollPercent }) => {
  const panel = document.getElementById('quran-pdf-panel');
  if (panel) panel.style.display = 'flex';
  renderStudentPDFPage(page);
  setTimeout(() => {
    const cont = document.getElementById('qpdf-container');
    if (cont) cont.scrollTop = scrollPercent * (cont.scrollHeight - cont.clientHeight);
  }, 400);
});

// PDF draw events from teacher (pdfMode:true)
socket.on('draw-begin', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  const panel = document.getElementById('quran-pdf-panel');
  if (panel && panel.style.display === 'none') panel.style.display = 'flex';
  const dctx = getPdfDrawCtx();
  if (!dctx) return;
  const el = document.getElementById('qpdf-draw-canvas');
  dctx.beginPath();
  dctx.arc(x * el.width, y * el.height, width / 2, 0, Math.PI * 2);
  dctx.fillStyle = color;
  dctx.fill();
  dctx.beginPath();
  dctx.moveTo(x * el.width, y * el.height);
});

socket.on('draw', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  const dctx = getPdfDrawCtx();
  if (!dctx) return;
  const el = document.getElementById('qpdf-draw-canvas');
  dctx.lineWidth = width;
  dctx.lineCap = dctx.lineJoin = 'round';
  dctx.strokeStyle = color;
  dctx.lineTo(x * el.width, y * el.height);
  dctx.stroke();
  dctx.beginPath();
  dctx.moveTo(x * el.width, y * el.height);
});

socket.on('draw-end', () => {
  if (sPdfDrawCtx) sPdfDrawCtx.beginPath();
});

socket.on('clear-canvas', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  if (sPdfDrawCtx) {
    const el = document.getElementById('qpdf-draw-canvas');
    if (el) sPdfDrawCtx.clearRect(0, 0, el.width, el.height);
  }
});

`;

c = c.slice(0, pdfStart) + newPdfSection + c.slice(pdfEnd);
fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', c, 'utf8');
console.log('PDF section replaced cleanly');
