const fs = require('fs');
const path = require('path');

function check() {
  const filePath = path.join(process.cwd(), 'public', 'cropped_debug.jpg');
  if (!fs.existsSync(filePath)) {
    console.error("File does not exist!");
    return;
  }

  const buffer = fs.readFileSync(filePath);
  
  // A simple JPEG size reader
  let i = 4;
  let r = null;
  while (i < buffer.length) {
    const marker = buffer.readUInt16BE(i);
    const length = buffer.readUInt16BE(i + 2);
    if (marker === 0xFFC0 || marker === 0xFFC2) {
      const height = buffer.readUInt16BE(i + 5);
      const width = buffer.readUInt16BE(i + 7);
      r = { width, height };
      break;
    }
    i += length + 2;
  }

  console.log("Image Dimensions of cropped_debug.jpg:", r);
}

check();
