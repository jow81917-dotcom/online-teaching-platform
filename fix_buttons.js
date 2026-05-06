const fs = require('fs');

// ── Fix teacher.html: raise bottom-bar z-index above PDF panel ──────────
let th = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/teacher.html', 'utf8');
th = th.replace(
  '#bottom-bar {\n      position: absolute;\n      bottom: 32px;\n      left: 0; right: 0;\n      z-index: 10;',
  '#bottom-bar {\n      position: absolute;\n      bottom: 32px;\n      left: 0; right: 0;\n      z-index: 35;'
);
fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/teacher.html', th, 'utf8');
console.log('teacher.html bottom-bar z-index fixed');

// ── Fix student.html: add mic button back + raise bottom-bar z-index ────
let sh = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.html', 'utf8');

// Add mic button to bottom bar
sh = sh.replace(
  '<!-- Bottom Control Bar -->\n  <div id="bottom-bar">\n    <button class="ctrl-btn" id="btn-hand" title="Raise Hand">✋</button>\n  </div>',
  '<!-- Bottom Control Bar -->\n  <div id="bottom-bar">\n    <button class="ctrl-btn" id="btn-hand" title="Raise Hand">✋</button>\n    <button class="ctrl-btn" id="btn-call" title="Enable/Disable Audio">🔇</button>\n  </div>'
);

// Raise bottom-bar z-index above PDF panel
sh = sh.replace(
  '#bottom-bar {\n      position: absolute;\n      bottom: 32px;\n      left: 0; right: 0;\n      z-index: 10;',
  '#bottom-bar {\n      position: absolute;\n      bottom: 32px;\n      left: 0; right: 0;\n      z-index: 35;'
);

// Restore btn-call CSS (was hidden)
sh = sh.replace(
  '/* Call/Audio Button - hidden, kept for JS compatibility */\n    #btn-call { display: none; }',
  `/* Call/Audio Button */
    #btn-call {
      background: #c0392b;
      box-shadow: 0 4px 20px rgba(192,57,43,0.35);
      opacity: 0.65;
      transition: background-color 0.3s, box-shadow 0.3s, opacity 0.3s;
    }
    #btn-call.in-call {
      background: #e5202e;
      box-shadow: 0 0 0 3px rgba(229,32,46,0.4), 0 4px 28px rgba(229,32,46,0.85);
      opacity: 1;
      animation: call-shake 2.8s ease-in-out infinite;
    }
    #btn-call.audio-on {
      background: #16c24a;
      box-shadow: 0 0 0 3px rgba(22,194,74,0.4), 0 4px 24px rgba(22,194,74,0.8);
      opacity: 1;
      animation: none;
    }`
);

fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.html', sh, 'utf8');
console.log('student.html mic button restored');

// ── Fix student.js: restore real btnCall reference ───────────────────────
let sj = fs.readFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', 'utf8');
sj = sj.replace(
  "const btnCall        = { classList: { add: ()=>{}, remove: ()=>{} }, innerHTML: '' }; // removed from UI",
  "const btnCall        = document.getElementById('btn-call');"
);

// Restore btnCall click handler
sj = sj.replace(
  '// ── Call/Audio Button (removed from UI, stub only) ──────────────────────────────────────\n// btnCall is a stub object, no event listener needed',
  `// ── Call/Audio Button ────────────────────────────────────────────────────────────────────
btnCall.addEventListener('click', async () => {
  if (!audioUnlocked) { unlockAudio(); return; }
  if (isInCall && audioEnabled) {
    if (teacherAudio) teacherAudio.muted = true;
    audioEnabled = false;
    updateAudioEnabledState(false);
    showToast('Audio muted', 'rgba(255,255,255,0.2)', '#fff');
  } else if (isInCall && !audioEnabled) {
    if (teacherAudio) { teacherAudio.muted = false; teacherAudio.play().catch(()=>{}); }
    audioEnabled = true;
    updateAudioEnabledState(true);
    showToast('Audio enabled', 'rgba(52,199,89,0.2)', '#34c759');
  } else {
    showToast('Waiting for teacher to start broadcast...', 'rgba(255,204,0,0.2)', '#ffcc00');
  }
});`
);

fs.writeFileSync('d:/xampp/htdocs/online-teaching-platform/audio-relay-classroom/public/student.js', sj, 'utf8');
console.log('student.js btnCall restored');
