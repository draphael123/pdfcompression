const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultContainer = document.getElementById('resultContainer');
const errorContainer = document.getElementById('errorContainer');
const downloadBtn = document.getElementById('downloadBtn');
const compressAnotherBtn = document.getElementById('compressAnotherBtn');
const tryAgainBtn = document.getElementById('tryAgainBtn');

let compressedFilename = '';

// Click to upload
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// File input change
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

function handleFile(file) {
    // Validate file type
    if (file.type !== 'application/pdf') {
        showError('Please upload a PDF file.');
        return;
    }
    
    // Validate file size (2000MB)
    const maxSize = 2000 * 1024 * 1024;
    if (file.size > maxSize) {
        showError('File size exceeds 2000MB limit.');
        return;
    }
    
    // Hide previous results/errors
    resultContainer.style.display = 'none';
    errorContainer.style.display = 'none';
    
    // Show progress
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading and compressing PDF...';
    
    // Upload and compress
    uploadAndCompress(file);
}

function uploadAndCompress(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        progressFill.style.width = progress + '%';
    }, 200);
    
    fetch('/compress', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        
        if (data.success) {
            setTimeout(() => {
                showResult(data);
            }, 500);
        } else {
            showError(data.error || 'Compression failed. Please try again.');
        }
    })
    .catch(error => {
        clearInterval(progressInterval);
        showError('An error occurred: ' + error.message);
    });
}

function showResult(data) {
    progressContainer.style.display = 'none';
    resultContainer.style.display = 'block';
    
    compressedFilename = data.filename;
    
    // Format file sizes
    document.getElementById('originalSize').textContent = formatFileSize(data.original_size);
    document.getElementById('compressedSize').textContent = formatFileSize(data.compressed_size);
    document.getElementById('compressionRatio').textContent = data.compression_ratio + '%';
}

function showError(message) {
    progressContainer.style.display = 'none';
    errorContainer.style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Download button
downloadBtn.addEventListener('click', () => {
    if (compressedFilename) {
        window.location.href = `/download/${compressedFilename}`;
        
        // Clean up after a delay
        setTimeout(() => {
            fetch(`/cleanup/${compressedFilename}`, { method: 'DELETE' }).catch(() => {});
        }, 5000);
    }
});

// Compress another button
compressAnotherBtn.addEventListener('click', () => {
    resultContainer.style.display = 'none';
    progressContainer.style.display = 'none';
    fileInput.value = '';
    compressedFilename = '';
});

// Try again button
tryAgainBtn.addEventListener('click', () => {
    errorContainer.style.display = 'none';
    fileInput.value = '';
});

