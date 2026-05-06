const fs = require('fs');
let c = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/teacher.html', 'utf8');

// 1. Add "Quran PDF" button to source menu (after src-qaida button closing </div>)
const menuEnd = c.indexOf("Open Qaida</button>\n  </div>");
const insertBtn = `Open Qaida</button>
    <button id="src-quran-pdf" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:none;background:transparent;color:#fff;font-size:13px;font-weight:600;cursor:pointer;border-radius:10px;text-align:left;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">📄 Quran PDF</button>
  </div>`;
c = c.slice(0, menuEnd) + insertBtn + c.slice(menuEnd + "Open Qaida</button>\n  </div>".length);

// 2. Add PDF viewer panel before </div><!-- end #phone -->
const phoneEnd = c.lastIndexOf('</div>\n\n<script src="/socket.io/socket.io.js">');
const pdfPanel = `
  <!-- Quran PDF Viewer Panel -->
  <div id="quran-pdf-panel" style="display:none;position:absolute;inset:0;top:var(--top-margin);z-index:28;background:#1a1a1a;flex-direction:column;overflow:hidden;">
    <div style="background:#0d0d0d;padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
      <button id="qpdf-prev" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:18px;">&#8592;</button>
      <input id="qpdf-page-input" type="number" min="1" value="1" style="width:50px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:#fff;padding:4px 6px;font-size:13px;text-align:center;"/>
      <span id="qpdf-total" style="color:rgba(255,255,255,0.4);font-size:12px;">/ —</span>
      <button id="qpdf-next" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:18px;">&#8594;</button>
      <div style="flex:1;"></div>
      <button id="qpdf-close" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:700;">Close</button>
    </div>
    <div id="qpdf-container" style="flex:1;overflow-y:auto;overflow-x:hidden;display:flex;justify-content:center;align-items:flex-start;background:#2a2a2a;position:relative;">
      <canvas id="qpdf-canvas" style="display:block;max-width:100%;"></canvas>
      <canvas id="qpdf-draw-canvas" style="position:absolute;top:0;left:0;touch-action:none;cursor:default;"></canvas>
    </div>
  </div>

`;

c = c.slice(0, phoneEnd) + pdfPanel + c.slice(phoneEnd);

fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/teacher.html', c, 'utf8');
console.log('teacher.html updated, phoneEnd=' + phoneEnd);
