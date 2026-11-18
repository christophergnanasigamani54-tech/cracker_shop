'use strict';

const fs = require('node:fs');
const path = require('node:path');

function backupImages(images, productImageDir, shopImageDir) {
  return [...new Set(images.filter(Boolean))].flatMap((image) => {
    const isShopLogo = /^\/shop-images\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(image);
    const directory = isShopLogo ? shopImageDir : productImageDir;
    const filename = path.basename(image);

    try {
      return [{ path: image, data: fs.readFileSync(path.join(directory, filename)).toString('base64') }];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      console.warn('Skipping missing image in backup:', image);
      return [];
    }
  });
}

module.exports = { backupImages };
