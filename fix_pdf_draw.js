const fs = require('fs');
let c = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', 'utf8');

// 1. Fix original draw-begin to skip pdfMode events
c = c.replace(
  'socket.on("draw-begin", ({ x, y, color, width }) => {\n  // Scale coordinates to match student\'s canvas size\n  const scaled = scaleCoordinates(x, y);',
  'socket.on("draw-begin", ({ x, y, color, width, pdfMode }) => {\n  if (pdfMode) return; // handled by PDF handler\n  // Scale coordinates to match student\'s canvas size\n  const scaled = scaleCoordinates(x, y);'
);

// 2. Fix original draw to skip pdfMode events
c = c.replace(
  'socket.on("draw", ({ x, y, color, width }) => {\n  // Scale coordinates to match student\'s canvas size\n  const scaled = scaleCoordinates(x, y);',
  'socket.on("draw", ({ x, y, color, width, pdfMode }) => {\n  if (pdfMode) return; // handled by PDF handler\n  // Scale coordinates to match student\'s canvas size\n  const scaled = scaleCoordinates(x, y);'
);

// 3. Fix PDF draw-begin handler to initialize sPdfDrawCtx if null
c = c.replace(
  "socket.on('draw-begin', ({ x, y, color, width, pdfMode }) => {\n  if (!pdfMode || !sPdfDrawCtx) return;",
  `socket.on('draw-begin', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  // Initialize sPdfDrawCtx if not yet set (PDF panel may not be open yet)
  if (!sPdfDrawCtx) {
    const dc = document.getElementById('qpdf-draw-canvas');
    if (dc) sPdfDrawCtx = dc.getContext('2d');
  }
  if (!sPdfDrawCtx) return;`
);

// 4. Fix PDF draw handler to initialize sPdfDrawCtx if null
c = c.replace(
  "socket.on('draw', ({ x, y, color, width, pdfMode }) => {\n  if (!pdfMode || !sPdfDrawCtx) return;",
  `socket.on('draw', ({ x, y, color, width, pdfMode }) => {
  if (!pdfMode) return;
  if (!sPdfDrawCtx) {
    const dc = document.getElementById('qpdf-draw-canvas');
    if (dc) sPdfDrawCtx = dc.getContext('2d');
  }
  if (!sPdfDrawCtx) return;`
);

// 5. Fix clear-canvas to only clear PDF canvas when in pdfMode, regular canvas otherwise
// The existing clear-canvas handler clears ctx (regular canvas)
// Add PDF canvas clear alongside it
c = c.replace(
  'socket.on("clear-canvas", () => {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.beginPath();\n});',
  `socket.on("clear-canvas", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  // Also clear PDF draw canvas if open
  if (sPdfDrawCtx) {
    const dc = document.getElementById('qpdf-draw-canvas');
    if (dc) sPdfDrawCtx.clearRect(0, 0, dc.width, dc.height);
  }
});`
);

fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', c, 'utf8');
console.log('done');
