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
    
    // Validate file size (1GB)
    const maxSize = 1024 * 1024 * 1024;
    if (file.size > maxSize) {
        showError('File size exceeds 1GB limit.');
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
    .then(async response => {
        clearInterval(progressInterval);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            // Try to get text error message
            const text = await response.text();
            throw new Error(text || `Server error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status}`);
        }
        
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
        // Extract meaningful error message
        let errorMessage = error.message;
        if (errorMessage.includes('Request Entity Too Large') || errorMessage.includes('413')) {
            errorMessage = 'File too large. Maximum size is 1GB.';
        } else if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
            errorMessage = 'Network error. Please check your connection and try again.';
        }
        showError('An error occurred: ' + errorMessage);
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

// Suggestions form
const suggestionForm = document.getElementById('suggestionForm');
const suggestionMessage = document.getElementById('suggestionMessage');

if (suggestionForm) {
    suggestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('suggestionName').value || 'Anonymous';
        const email = document.getElementById('suggestionEmail').value || '';
        const suggestion = document.getElementById('suggestionText').value;
        
        if (!suggestion.trim()) {
            showSuggestionMessage('Please enter your suggestion.', 'error');
            return;
        }
        
        try {
            const response = await fetch('/suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, suggestion })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showSuggestionMessage(data.message || 'Thank you for your suggestion!', 'success');
                suggestionForm.reset();
            } else {
                showSuggestionMessage(data.error || 'Failed to submit suggestion.', 'error');
            }
        } catch (error) {
            showSuggestionMessage('An error occurred: ' + error.message, 'error');
        }
    });
}

function showSuggestionMessage(message, type) {
    if (suggestionMessage) {
        suggestionMessage.textContent = message;
        suggestionMessage.className = `suggestion-message ${type}`;
        suggestionMessage.style.display = 'block';
        
        // Scroll to message
        suggestionMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        setTimeout(() => {
            if (type === 'success') {
                suggestionMessage.style.display = 'none';
            }
        }, 5000);
    }
}

