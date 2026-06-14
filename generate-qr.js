const qr = require('qrcode');
const path = require('path');

const url = 'exp://192.168.1.25:8081';
const outputPath = path.join(__dirname, 'qrcode.png');

qr.toFile(outputPath, url, {
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  },
  width: 300
}, function (err) {
  if (err) {
    console.error('Error generating QR code:', err);
    process.exit(1);
  }
  console.log('QR Code successfully saved to:', outputPath);
});
