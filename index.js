"use strict";
import png from './png.js';
let buffer;

const input = document.querySelector('input');
input.addEventListener('change', async function(e) {
  const [file] = e.target.files;
  buffer = await file.arrayBuffer();
  const imageData = png.decode(buffer);
  document.getElementById('imgMeta').innerHTML = JSON.stringify(imageData.IHDR, 0,4);
  PR.prettyPrint();
});