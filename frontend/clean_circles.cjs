const fs = require('fs');
const path = 'g:/github/TalentHub/frontend/src/pages/InternSeatReservation.jsx';
let code = fs.readFileSync(path, 'utf8');

const str = `  {/* Section A Pillar Circle (centerX=180, centerY=377, radius=68) */}
  <div
    className="absolute rounded-full pointer-events-none"
    style={{
      left: "112px",
      top: "309px",
      width: "136px",
      height: "136px",
      backgroundColor: "#8ea1b6",
      border: "2.5px solid #64748b",
      boxShadow: "0 4px 14px rgba(100, 116, 139, 0.22), inset 0 2px 4px rgba(255, 255, 255, 0.35)",
      zIndex: 0,
    }}
  />

  {/* Section B Pillar Circle (centerX=920, centerY=377, radius=68) */}
  <div
    className="absolute rounded-full pointer-events-none"
    style={{
      left: "852px",
      top: "309px",
      width: "136px",
      height: "136px",
      backgroundColor: "#8ea1b6",
      border: "2.5px solid #64748b",
      boxShadow: "0 4px 14px rgba(100, 116, 139, 0.22), inset 0 2px 4px rgba(255, 255, 255, 0.35)",
      zIndex: 0,
    }}
  />`;

let index = code.lastIndexOf(str);
if (index !== -1) {
    code = code.substring(0, index) + code.substring(index + str.length);
    fs.writeFileSync(path, code);
    console.log('Removed duplicate circles');
} else {
    console.log('Duplicate not found');
}
