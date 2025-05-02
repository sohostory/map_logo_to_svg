const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dcNameInput = document.getElementById('dc-name');
const originalPreview = document.getElementById('original-preview');
const outputPreview = document.getElementById('output-preview');
const convertBtn = document.getElementById('convert-btn');
const spinner = document.getElementById('spinner');

let uploadedImage;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.style.background = '#e6f2ff';
});
dropZone.addEventListener('dragleave', () => {
    dropZone.style.background = '';
});
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.background = '';
    const file = e.dataTransfer.files[0];
    handleFile(file);
});
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

function handleFile(file) {
    uploadedImage = file;
    const reader = new FileReader();
    reader.onload = e => {
        originalPreview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%;">`;
        outputPreview.innerHTML = `
            <img src="${e.target.result}">
            <div class="preview-message">
                Preview ready – click “Convert to SVG” to optimize and download
            </div>
        `;
    };
    reader.readAsDataURL(file);
}

convertBtn.addEventListener('click', async () => {
    if (!uploadedImage || !dcNameInput.value) {
        alert('Please upload an image and enter a data center name.');
        return;
    }
    spinner.style.display = 'block';
    try {
        const img = new Image();
        img.src = URL.createObjectURL(uploadedImage);
        img.onload = async () => {
            const target = 100;
            let w, h;
            if (img.width > img.height) {
                w = target;
                h = (img.height / img.width) * target;
            } else {
                h = target;
                w = (img.width / img.height) * target;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/webp', 0.8);

            const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <image href="${dataUrl}" width="${w}" height="${h}" x="${(100 - w) / 2}" y="${(100 - h) / 2}"/>
</svg>`;

            if (window.svgo) {
                const result = await window.svgo.optimize(svg);
                processSVG(result.data);
            } else {
                processSVG(svg);
            }
        };
    } catch (error) {
        alert('Error during processing: ' + error.message);
        spinner.style.display = 'none';
    }
});

function processSVG(svgData) {
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const sizeKB = Math.round(blob.size / 1024);
    outputPreview.innerHTML = ''; // clear old preview
    if (blob.size > 30000) {
        alert(`Warning: Export file is ${sizeKB} KB, larger than 30KB.`);
    }
    const name = `${dcNameInput.value}_mapLogo_optimized.svg`;
    const url = URL.createObjectURL(blob);
    outputPreview.innerHTML = `
        <img src="${url}">
        <div>Export size: ${sizeKB} KB</div>
        <a href="${url}" download="${name}">Download Optimized SVG</a>
    `;
    spinner.style.display = 'none';
}