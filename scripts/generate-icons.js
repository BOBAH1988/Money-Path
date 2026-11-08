import sharp from 'sharp';
import fs from 'fs';

const sizes = [96, 128, 180, 192, 256, 512];
const svgFiles = ['app-icon-new-1.svg', 'app-icon-new-2.svg', 'app-icon-new-3.svg', 'app-icon-new-4.svg'];

svgFiles.forEach(svgFile => {
  const svg = fs.readFileSync('./public/' + svgFile);
  const name = svgFile.replace('.svg', '');

  sizes.forEach(size => {
    sharp(svg)
      .resize(size, size)
      .png()
      .toFile('./public/icons/' + name + '-' + size + '.png')
      .then(() => console.log('Generated: ' + name + '-' + size + '.png'))
      .catch(err => console.error(err));
  });
});