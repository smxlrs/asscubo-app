const QRCode = require('qrcode');
const path = require('path');

const ip = '192.168.1.25';
const port = 8081;
const url = `exp://${ip}:${port}`;

const outputPath = path.join('I:/PARTTIME/AG', 'qrcode.png');

QRCode.toFile(outputPath, url, {
  errorCorrectionLevel: 'M',
  type: 'png',
  width: 400,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#ffffff'
  }
}, (err) => {
  if (err) {
    console.error('Error generating QR code:', err);
  } else {
    console.log(`QR Code saved to: ${outputPath}`);
    console.log(`Scan URL: ${url}`);
  }
});
