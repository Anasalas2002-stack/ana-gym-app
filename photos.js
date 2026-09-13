// Fotos de pesos por ejercicio + visor
const PHOTOS = JSON.parse(localStorage.getItem('exercisePhotos') || '{}');
function getPhotoKey(exId, week) { return `${exId}_w${week}`; }
function getPhoto(exId, week) { return PHOTOS[getPhotoKey(exId, week)] || null; }

function savePhoto(exId, week, dataUrl) {
  PHOTOS[getPhotoKey(exId, week)] = dataUrl;
  try { localStorage.setItem('exercisePhotos', JSON.stringify(PHOTOS)); }
  catch(e) {
    const keys = Object.keys(PHOTOS);
    if (keys.length > 15) { delete PHOTOS[keys[0]]; localStorage.setItem('exercisePhotos', JSON.stringify(PHOTOS)); }
  }
}

function compressImage(file, callback, maxW = 700, quality = 0.55) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = h * maxW / w; w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function triggerPhotoCapture(exId, week) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
  input.onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    compressImage(f, dataUrl => {
      savePhoto(exId, week, dataUrl);
      showToast('📷 Foto guardada');
      if (STATE.currentTab === 'today') renderToday();
    });
  };
  input.click();
}

function viewPhotoFullscreen(src) {
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;background:rgba(5,4,8,.95);z-index:400;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;cursor:pointer';
  o.onclick = () => document.body.removeChild(o);
  o.innerHTML = `<img src="${src}" style="max-width:100%;max-height:82vh;border-radius:14px;object-fit:contain"><div style="color:#777;font-size:12px;margin-top:12px">Toca para cerrar</div>`;
  document.body.appendChild(o);
}
