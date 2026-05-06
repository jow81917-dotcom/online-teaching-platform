const fs = require('fs');
let c = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', 'utf8');

// Replace the PDF draw-begin handler
const oldBegin = `socket.on('draw-begin', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  // Initialize sPdfDrawCtx if not yet set (PDF panel may not be open yet)
  if (!sPdfDrawCtx) {
    const dc = document.getElementById('qpdf-draw-canvas');
    if (dc) sPdfDrawCtx = dc.getContext('2d');
  }
  if (!sPdfDrawCtx) return;`;

const newBegin = `socket.on('draw-begin', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  // Ensure PDF panel is visible
  const panel = document.getElementById('quran-pdf-panel');
  if (panel && panel.style.display === 'none') panel.style.display = 'flex';
  // Get/init draw context
  const dc = document.getElementById('qpdf-draw-canvas');
  if (!dc) return;
  if (!sPdfDrawCtx) sPdfDrawCtx = dc.getContext('2d');
  // If canvas has no size yet, wait for quran-sync to render the page
  if (dc.width === 0 || dc.height === 0) return;`;

// Replace PDF draw handler
const oldDraw = `socket.on('draw', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  if (!sPdfDrawCtx) {
    const dc = document.getElementById('qpdf-draw-canvas');
    if (dc) sPdfDrawCtx = dc.getContext('2d');
  }
  if (!sPdfDrawCtx) return;`;

const newDraw = `socket.on('draw', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  const dc = document.getElementById('qpdf-draw-canvas');
  if (!dc || dc.width === 0) return;
  if (!sPdfDrawCtx) sPdfDrawCtx = dc.getContext('2d');`;

if (c.includes(oldBegin)) {
  c = c.replace(oldBegin, newBegin);
  console.log('draw-begin replaced');
} else {
  console.log('draw-begin NOT FOUND - trying slice approach');
  const i = c.indexOf("socket.on('draw-begin', ({ x, y, color, width, pdfMode })");
  const e = c.indexOf('\n});', i) + 4;
  const newHandler = `socket.on('draw-begin', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  const panel = document.getElementById('quran-pdf-panel');
  if (panel && panel.style.display === 'none') panel.style.display = 'flex';
  const dc = document.getElementById('qpdf-draw-canvas');
  if (!dc || dc.width === 0 || dc.height === 0) return;
  if (!sPdfDrawCtx) sPdfDrawCtx = dc.getContext('2d');
  sPdfDrawCtx.beginPath();
  sPdfDrawCtx.arc(x * dc.width, y * dc.height, width / 2, 0, Math.PI * 2);
  sPdfDrawCtx.fillStyle = color;
  sPdfDrawCtx.fill();
  sPdfDrawCtx.beginPath();
  sPdfDrawCtx.moveTo(x * dc.width, y * dc.height);
});`;
  c = c.slice(0, i) + newHandler + c.slice(e);
  console.log('draw-begin replaced via slice at', i, e);
}

if (c.includes(oldDraw)) {
  c = c.replace(oldDraw, newDraw);
  console.log('draw replaced');
} else {
  console.log('draw NOT FOUND - trying slice approach');
  const i = c.indexOf("socket.on('draw', ({ x, y, color, width, pdfMode })");
  const e = c.indexOf('\n});', i) + 4;
  const newHandler = `socket.on('draw', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  const dc = document.getElementById('qpdf-draw-canvas');
  if (!dc || dc.width === 0) return;
  if (!sPdfDrawCtx) sPdfDrawCtx = dc.getContext('2d');
  sPdfDrawCtx.lineWidth = width;
  sPdfDrawCtx.lineCap = sPdfDrawCtx.lineJoin = 'round';
  sPdfDrawCtx.strokeStyle = color;
  sPdfDrawCtx.lineTo(x * dc.width, y * dc.height);
  sPdfDrawCtx.stroke();
  sPdfDrawCtx.beginPath();
  sPdfDrawCtx.moveTo(x * dc.width, y * dc.height);
});`;
  c = c.slice(0, i) + newHandler + c.slice(e);
  console.log('draw replaced via slice at', i, e);
}

fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', c, 'utf8');
console.log('done');
