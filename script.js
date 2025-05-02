const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dcNameInput = document.getElementById('dc-name');
const originalPreview = document.getElementById('original-preview');
const outputPreview = document.getElementById('output-preview');
const convertBtn = document.getElementById('convert-btn');
const spinner = document.getElementById('spinner');

let uploadedImage;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.background = '#e6f2ff'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.background = ''; });
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
        originalPreview.innerHTML = `<img src="${e.target.result}">`;
        outputPreview.innerHTML = `<img src="${e.target.result}"><div class="preview-message">Preview ready – click Convert to SVG</div>`;
    };
    reader.readAsDataURL(file);
}

convertBtn.addEventListener('click', () => {
    if (!uploadedImage || !dcNameInput.value) {
        alert('Please upload an image and enter a data center name.');
        return;
    }
    spinner.style.display = 'block';

    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');

            // Calculate proportional scaling
            let targetWidth, targetHeight;
            if (img.width > img.height) {
                targetWidth = 200;
                targetHeight = (img.height / img.width) * 200;
            } else {
                targetHeight = 200;
                targetWidth = (img.width / img.height) * 200;
            }

            const offsetX = (200 - targetWidth) / 2;
            const offsetY = (200 - targetHeight) / 2;

            // Draw scaled and centered image
            ctx.drawImage(img, offsetX, offsetY, targetWidth, targetHeight);

            // Export to WebP
            const dataUrl = canvas.toDataURL('image/webp', 0.6); // reduce quality for size
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
<image href="${dataUrl}" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

            const blob = new Blob([svg], { type: 'image/svg+xml' });

            blob.text().then(() => {
                const sizeKB = Math.round(blob.size / 1024);

                if (sizeKB > 30) {
                    alert(`Warning: Export file is ${sizeKB} KB, larger than 30KB.`);
                }

                const name = `${dcNameInput.value}_mapLogo_optimized.svg`;
                const url = URL.createObjectURL(blob);

                outputPreview.innerHTML = `
                    <img src="${url}" style="max-width:100%; max-height:100%;">
                    <div>Export size: ${sizeKB} KB</div>
                    <a href="${url}" download="${name}">Download Optimized SVG</a>
                `;

                spinner.style.display = 'none';
            }).catch(err => {
                alert('Error generating SVG preview.');
                spinner.style.display = 'none';
            });
        };

        img.onerror = () => {
            alert('Failed to load image.');
            spinner.style.display = 'none';
        };
    };

    reader.readAsDataURL(uploadedImage);
});