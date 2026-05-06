const fs = require('fs');
let c = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', 'utf8');

const pdfCode = `
// ── Quran PDF Viewer (student - synced from teacher) ──────────────────────
const QURAN_PDF_URL = '/assets/Quranpdfhub-Arabic-Text-Quran.pdf';
let sPdfDoc = null;
let sPdfCurrentPage = 1;
let sPdfRendering = false;
let sPdfPendingPage = null;
let sPdfDrawCtx = null;

function loadStudentPDF(callback) {
  if (sPdfDoc) { if (callback) callback(); return; }
  if (!window.pdfjsLib) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLib.getDocument(QURAN_PDF_URL).promise.then(pdf => {
        sPdfDoc = pdf;
        const tot = document.getElementById('qpdf-total');
        if (tot) tot.textContent = '/ ' + pdf.numPages;
        if (callback) callback();
      }).catch(e => console.error('[pdf student]', e));
    };
    document.head.appendChild(script);
  } else {
    pdfjsLib.getDocument(QURAN_PDF_URL).promise.then(pdf => {
      sPdfDoc = pdf;
      const tot = document.getElementById('qpdf-total');
      if (tot) tot.textContent = '/ ' + pdf.numPages;
      if (callback) callback();
    }).catch(e => console.error('[pdf student]', e));
  }
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

    const dc = document.getElementById('qpdf-draw-canvas');
    dc.width  = viewport.width;
    dc.height = viewport.height;
    sPdfDrawCtx = dc.getContext('2d');

    page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise.then(() => {
      sPdfRendering = false;
      if (sPdfPendingPage) { const p = sPdfPendingPage; sPdfPendingPage = null; renderStudentPDFPage(p); }
    });
  });
}

// Socket events from teacher
socket.on('quran-open', () => {
  const panel = document.getElementById('quran-pdf-panel');
  if (panel) {
    panel.style.display = 'flex';
    loadStudentPDF(() => renderStudentPDFPage(sPdfCurrentPage));
  }
});

socket.on('quran-close', () => {
  const panel = document.getElementById('quran-pdf-panel');
  if (panel) panel.style.display = 'none';
});

socket.on('quran-sync', ({ page, scrollPercent }) => {
  const panel = document.getElementById('quran-pdf-panel');
  if (!panel || panel.style.display === 'none') {
    panel.style.display = 'flex';
  }
  renderStudentPDFPage(page);
  // Apply scroll after render
  setTimeout(() => {
    const cont = document.getElementById('qpdf-container');
    if (cont) cont.scrollTop = scrollPercent * (cont.scrollHeight - cont.clientHeight);
  }, 300);
});

// Override draw events to also draw on PDF canvas when in PDF mode
const _origDrawBegin = socket.listeners('draw-begin')[0];
socket.on('draw-begin', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode || !sPdfDrawCtx) return;
  const dc = document.getElementById('qpdf-draw-canvas');
  sPdfDrawCtx.beginPath();
  sPdfDrawCtx.arc(x * dc.width, y * dc.height, width / 2, 0, Math.PI * 2);
  sPdfDrawCtx.fillStyle = color;
  sPdfDrawCtx.fill();
  sPdfDrawCtx.beginPath();
  sPdfDrawCtx.moveTo(x * dc.width, y * dc.height);
});

socket.on('draw', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode || !sPdfDrawCtx) return;
  const dc = document.getElementById('qpdf-draw-canvas');
  sPdfDrawCtx.lineWidth = width;
  sPdfDrawCtx.lineCap = sPdfDrawCtx.lineJoin = 'round';
  sPdfDrawCtx.strokeStyle = color;
  sPdfDrawCtx.lineTo(x * dc.width, y * dc.height);
  sPdfDrawCtx.stroke();
  sPdfDrawCtx.beginPath();
  sPdfDrawCtx.moveTo(x * dc.width, y * dc.height);
});

socket.on('clear-canvas', () => {
  if (sPdfDrawCtx) {
    const dc = document.getElementById('qpdf-draw-canvas');
    sPdfDrawCtx.clearRect(0, 0, dc.width, dc.height);
  }
});

`;

const insertAt = c.lastIndexOf('console.log("[student] ready');
c = c.slice(0, insertAt) + pdfCode + c.slice(insertAt);
fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', c, 'utf8');
console.log('student.js updated');
