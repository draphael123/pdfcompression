// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');
        
        // Reset states
        resetCompressState();
        resetMergeState();
    });
});

// Compress PDF functionality
const compressUpload = document.getElementById('compress-upload');
const compressFile = document.getElementById('compress-file');
const compressProgress = document.getElementById('compress-progress');
const compressResult = document.getElementById('compress-result');
const compressError = document.getElementById('compress-error');
const compressDownload = document.getElementById('compress-download');

let currentCompressedFile = null;

compressUpload.addEventListener('click', () => compressFile.click());
compressUpload.addEventListener('dragover', handleDragOver);
compressUpload.addEventListener('dragleave', handleDragLeave);
compressUpload.addEventListener('drop', handleCompressDrop);
compressFile.addEventListener('change', (e) => handleCompressFile(e.target.files[0]));

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleCompressDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleCompressFile(file);
}

function handleCompressFile(file) {
    if (!file.type.includes('pdf')) {
        showError('compress', 'Please select a PDF file');
        return;
    }
    
    const maxSize = 900000 * 1024; // 900MB
    if (file.size > maxSize) {
        showError('compress', `File too large. Maximum size is 900MB`);
        return;
    }
    
    uploadAndCompress(file);
}

function uploadAndCompress(file) {
    resetCompressState();
    
    const formData = new FormData();
    formData.append('file', file);
    
    compressProgress.style.display = 'block';
    simulateProgress('compress');
    
    fetch('/compress', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => Promise.reject(err));
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            currentCompressedFile = data.filename;
            showCompressResult(data);
        } else {
            showError('compress', data.error || 'Compression failed');
        }
    })
    .catch(error => {
        showError('compress', error.error || error.message || 'An error occurred');
    })
    .finally(() => {
        compressProgress.style.display = 'none';
    });
}

function showCompressResult(data) {
    document.getElementById('original-size').textContent = formatBytes(data.original_size);
    document.getElementById('compressed-size').textContent = formatBytes(data.compressed_size);
    document.getElementById('compression-ratio').textContent = `${data.compression_ratio}%`;
    compressResult.style.display = 'block';
    compressResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

compressDownload.addEventListener('click', () => {
    if (currentCompressedFile) {
        window.location.href = `/download/${currentCompressedFile}`;
    }
});

function resetCompressState() {
    compressResult.style.display = 'none';
    compressError.style.display = 'none';
    currentCompressedFile = null;
}

// Merge PDFs functionality
const mergeUpload = document.getElementById('merge-upload');
const mergeFiles = document.getElementById('merge-files');
const mergeFileList = document.getElementById('merge-file-list');
const mergeFilesList = document.getElementById('merge-files-list');
const mergeProgress = document.getElementById('merge-progress');
const mergeResult = document.getElementById('merge-result');
const mergeError = document.getElementById('merge-error');
const mergeDownload = document.getElementById('merge-download');

let selectedFiles = [];
let currentMergedFile = null;

mergeUpload.addEventListener('click', () => mergeFiles.click());
mergeUpload.addEventListener('dragover', handleDragOver);
mergeUpload.addEventListener('dragleave', handleDragLeave);
mergeUpload.addEventListener('drop', handleMergeDrop);
mergeFiles.addEventListener('change', (e) => handleMergeFiles(Array.from(e.target.files)));

function handleMergeDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.includes('pdf'));
    if (files.length > 0) handleMergeFiles(files);
}

function handleMergeFiles(files) {
    const pdfFiles = files.filter(f => f.type.includes('pdf'));
    
    if (pdfFiles.length < 2) {
        showError('merge', 'Please select at least 2 PDF files');
        return;
    }
    
    const maxSize = 900000 * 1024;
    const tooLarge = pdfFiles.find(f => f.size > maxSize);
    if (tooLarge) {
        showError('merge', 'One or more files are too large. Maximum size is 900MB per file');
        return;
    }
    
    selectedFiles = pdfFiles;
    displayMergeFileList();
    uploadAndMerge();
}

function displayMergeFileList() {
    mergeFilesList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${file.name}</span>
            <span>${formatBytes(file.size)}</span>
        `;
        mergeFilesList.appendChild(li);
    });
    mergeFileList.style.display = 'block';
}

function uploadAndMerge() {
    resetMergeState();
    
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    mergeProgress.style.display = 'block';
    simulateProgress('merge');
    
    fetch('/merge', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => Promise.reject(err));
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            currentMergedFile = data.filename;
            showMergeResult(data);
        } else {
            showError('merge', data.error || 'Merge failed');
        }
    })
    .catch(error => {
        showError('merge', error.error || error.message || 'An error occurred');
    })
    .finally(() => {
        mergeProgress.style.display = 'none';
    });
}

function showMergeResult(data) {
    document.getElementById('merge-count').textContent = data.file_count;
    document.getElementById('merge-total-size').textContent = formatBytes(data.total_size);
    document.getElementById('merge-size').textContent = formatBytes(data.merged_size);
    mergeResult.style.display = 'block';
    mergeResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

mergeDownload.addEventListener('click', () => {
    if (currentMergedFile) {
        window.location.href = `/download/${currentMergedFile}`;
    }
});

function resetMergeState() {
    mergeResult.style.display = 'none';
    mergeError.style.display = 'none';
    mergeFileList.style.display = 'none';
    currentMergedFile = null;
}

// Suggestions functionality
const suggestionForm = document.getElementById('suggestion-form');
const suggestionMessage = document.getElementById('suggestion-message');

suggestionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('suggestion-name').value.trim();
    const email = document.getElementById('suggestion-email').value.trim();
    const suggestion = document.getElementById('suggestion-text').value.trim();
    
    if (!suggestion) {
        showSuggestionMessage('Please enter a suggestion', 'error');
        return;
    }
    
    const submitBtn = suggestionForm.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        const response = await fetch('/suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, suggestion })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuggestionMessage(data.message || 'Thank you for your suggestion!', 'success');
            suggestionForm.reset();
            loadSuggestions();
        } else {
            showSuggestionMessage(data.error || 'Failed to submit suggestion', 'error');
        }
    } catch (error) {
        showSuggestionMessage('An error occurred. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Suggestion';
    }
});

function showSuggestionMessage(message, type) {
    suggestionMessage.textContent = message;
    suggestionMessage.className = `suggestion-message ${type}`;
    suggestionMessage.style.display = 'block';
    
    setTimeout(() => {
        suggestionMessage.style.display = 'none';
    }, 5000);
}

function loadSuggestions() {
    fetch('/suggestions')
        .then(response => response.json())
        .then(data => {
            displaySuggestions(data.suggestions || []);
        })
        .catch(error => {
            console.error('Error loading suggestions:', error);
        });
}

function displaySuggestions(suggestions) {
    const list = document.getElementById('suggestions-list');
    list.innerHTML = '';
    
    if (suggestions.length === 0) {
        list.innerHTML = '<p style="color: #666; text-align: center;">No suggestions yet. Be the first!</p>';
        return;
    }
    
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <div class="suggestion-item-header">
                <span><strong>${suggestion.name}</strong></span>
                <span>${formatDate(suggestion.timestamp)}</span>
            </div>
            <div class="suggestion-item-text">${escapeHtml(suggestion.suggestion)}</div>
        `;
        list.appendChild(item);
    });
}

// Utility functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function simulateProgress(type) {
    const progressFill = document.getElementById(`${type}-progress-fill`);
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 90) {
            clearInterval(interval);
        } else {
            width += Math.random() * 10;
            progressFill.style.width = Math.min(width, 90) + '%';
        }
    }, 200);
}

function showError(type, message) {
    const errorContainer = document.getElementById(`${type}-error`);
    const errorMessage = errorContainer.querySelector('.error-message');
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 5000);
}

// Load suggestions on page load
loadSuggestions();
