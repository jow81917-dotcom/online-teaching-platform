const fs = require('fs');
let c = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.html', 'utf8');

const phoneEnd = c.lastIndexOf('</div>\n\n<script src="/socket.io/socket.io.js">');

const pdfPanel = `
  <!-- Quran PDF Viewer Panel (student - read only) -->
  <div id="quran-pdf-panel" style="display:none;position:absolute;inset:0;top:var(--top-margin);z-index:28;background:#1a1a1a;flex-direction:column;overflow:hidden;">
    <div style="background:#0d0d0d;padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
      <span style="color:rgba(255,255,255,0.6);font-size:12px;font-weight:600;">📄 Quran</span>
      <span id="qpdf-page-label" style="color:#fff;font-size:13px;font-weight:700;margin-left:8px;">Page 1</span>
      <span id="qpdf-total" style="color:rgba(255,255,255,0.4);font-size:12px;">/ —</span>
      <div style="flex:1;"></div>
      <span style="color:rgba(255,255,255,0.3);font-size:10px;">Teacher controlled</span>
    </div>
    <div id="qpdf-container" style="flex:1;overflow-y:auto;overflow-x:hidden;display:flex;justify-content:center;align-items:flex-start;background:#2a2a2a;position:relative;">
      <canvas id="qpdf-canvas" style="display:block;max-width:100%;"></canvas>
      <canvas id="qpdf-draw-canvas" style="position:absolute;top:0;left:0;touch-action:none;cursor:default;pointer-events:none;"></canvas>
    </div>
  </div>

`;

c = c.slice(0, phoneEnd) + pdfPanel + c.slice(phoneEnd);
fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.html', c, 'utf8');
console.log('student.html updated');
