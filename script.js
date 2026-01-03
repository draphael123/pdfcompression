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
let mergeFiles = [];
let isMergeMode = false;

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
    
    // Validate file size (900000 KB)
    const maxSize = 900000 * 1024;
    if (file.size > maxSize) {
        showError('File size exceeds 900000 KB limit.');
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
            errorMessage = 'File too large. Maximum size is 900000 KB.';
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
    
    // Show compression stats, hide merge stats
    document.getElementById('fileStats').style.display = 'block';
    document.getElementById('mergeStats').style.display = 'none';
    
    document.getElementById('resultTitle').textContent = 'Compression Complete!';
    
    // Format file sizes
    document.getElementById('originalSize').textContent = formatFileSize(data.original_size);
    document.getElementById('compressedSize').textContent = formatFileSize(data.compressed_size);
    document.getElementById('compressionRatio').textContent = data.compression_ratio + '%';
    
    // Update button text
    document.getElementById('downloadBtn').textContent = 'Download Compressed PDF';
    document.getElementById('compressAnotherBtn').textContent = 'Compress Another PDF';
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

// Tab switching
function switchTab(tab) {
    const compressTab = document.getElementById('compressTab');
    const mergeTab = document.getElementById('mergeTab');
    const compressContent = document.getElementById('compressContent');
    const mergeContent = document.getElementById('mergeContent');
    
    if (tab === 'compress') {
        compressTab.classList.add('active');
        mergeTab.classList.remove('active');
        compressContent.style.display = 'block';
        mergeContent.style.display = 'none';
        isMergeMode = false;
        resultContainer.style.display = 'none';
        errorContainer.style.display = 'none';
    } else {
        compressTab.classList.remove('active');
        mergeTab.classList.add('active');
        compressContent.style.display = 'none';
        mergeContent.style.display = 'block';
        isMergeMode = true;
        resultContainer.style.display = 'none';
        errorContainer.style.display = 'none';
    }
}

// Merge functionality
const mergeUploadArea = document.getElementById('mergeUploadArea');
const mergeFileInput = document.getElementById('mergeFileInput');
const mergeFileList = document.getElementById('mergeFileList');
const mergeFilesList = document.getElementById('mergeFilesList');
const mergeBtn = document.getElementById('mergeBtn');
const clearFilesBtn = document.getElementById('clearFilesBtn');

if (mergeUploadArea) {
    mergeUploadArea.addEventListener('click', () => {
        mergeFileInput.click();
    });
}

if (mergeFileInput) {
    mergeFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleMergeFiles(Array.from(e.target.files));
        }
    });
}

if (mergeUploadArea) {
    mergeUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        mergeUploadArea.classList.add('dragover');
    });

    mergeUploadArea.addEventListener('dragleave', () => {
        mergeUploadArea.classList.remove('dragover');
    });

    mergeUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        mergeUploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            handleMergeFiles(Array.from(e.dataTransfer.files));
        }
    });
}

function handleMergeFiles(files) {
    const maxSize = 900000 * 1024;
    const validFiles = [];
    
    files.forEach(file => {
        if (file.type !== 'application/pdf') {
            showError('Only PDF files are allowed.');
            return;
        }
        
        if (file.size > maxSize) {
            showError(`File "${file.name}" exceeds 900000 KB limit.`);
            return;
        }
        
        validFiles.push(file);
    });
    
    if (validFiles.length > 0) {
        mergeFiles = validFiles;
        updateMergeFileList();
    }
}

function updateMergeFileList() {
    if (mergeFiles.length < 2) {
        mergeFileList.style.display = 'none';
        return;
    }
    
    mergeFileList.style.display = 'block';
    mergeFilesList.innerHTML = '';
    
    mergeFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="file-name">${escapeHtml(file.name)}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
        `;
        mergeFilesList.appendChild(li);
    });
}

if (mergeBtn) {
    mergeBtn.addEventListener('click', () => {
        if (mergeFiles.length < 2) {
            showError('Please select at least 2 PDF files to merge.');
            return;
        }
        
        uploadAndMerge();
    });
}

if (clearFilesBtn) {
    clearFilesBtn.addEventListener('click', () => {
        mergeFiles = [];
        mergeFileInput.value = '';
        mergeFileList.style.display = 'none';
    });
}

function uploadAndMerge() {
    const formData = new FormData();
    
    mergeFiles.forEach(file => {
        formData.append('files', file);
    });
    
    // Hide previous results/errors
    resultContainer.style.display = 'none';
    errorContainer.style.display = 'none';
    
    // Show progress
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading and merging PDFs...';
    
    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        progressFill.style.width = progress + '%';
    }, 200);
    
    fetch('/merge', {
        method: 'POST',
        body: formData
    })
    .then(async response => {
        clearInterval(progressInterval);
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
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
                showMergeResult(data);
            }, 500);
        } else {
            showError(data.error || 'Merge failed. Please try again.');
        }
    })
    .catch(error => {
        clearInterval(progressInterval);
        let errorMessage = error.message;
        if (errorMessage.includes('Request Entity Too Large') || errorMessage.includes('413')) {
            errorMessage = 'File too large. Maximum size is 900000 KB per file.';
        } else if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
            errorMessage = 'Network error. Please check your connection and try again.';
        }
        showError('An error occurred: ' + errorMessage);
    });
}

function showMergeResult(data) {
    progressContainer.style.display = 'none';
    resultContainer.style.display = 'block';
    
    compressedFilename = data.filename;
    
    // Hide compression stats, show merge stats
    document.getElementById('fileStats').style.display = 'none';
    document.getElementById('mergeStats').style.display = 'block';
    
    document.getElementById('resultTitle').textContent = 'Merge Complete!';
    document.getElementById('fileCount').textContent = data.file_count;
    document.getElementById('totalSize').textContent = formatFileSize(data.total_size);
    document.getElementById('mergedSize').textContent = formatFileSize(data.merged_size);
    
    // Update button text
    document.getElementById('downloadBtn').textContent = 'Download Merged PDF';
    document.getElementById('compressAnotherBtn').textContent = 'Merge More PDFs';
    
    // Clear merge files
    mergeFiles = [];
    mergeFileInput.value = '';
    mergeFileList.style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
                // Reload suggestions after successful submission
                loadSuggestions();
            }
        }, 5000);
    }
}

// Load and display suggestions
async function loadSuggestions() {
    const suggestionsList = document.getElementById('suggestionsList');
    if (!suggestionsList) return;
    
    try {
        const response = await fetch('/suggestions');
        const data = await response.json();
        
        if (data.suggestions && data.suggestions.length > 0) {
            displaySuggestions(data.suggestions);
        } else {
            suggestionsList.innerHTML = '<p class="no-suggestions">No suggestions yet. Be the first to share your ideas!</p>';
        }
    } catch (error) {
        suggestionsList.innerHTML = '<p class="no-suggestions">Unable to load suggestions.</p>';
    }
}

function displaySuggestions(suggestions) {
    const suggestionsList = document.getElementById('suggestionsList');
    if (!suggestionsList) return;
    
    suggestionsList.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        const date = new Date(suggestion.timestamp);
        const formattedDate = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        item.innerHTML = `
            <div class="suggestion-item-header">
                <span class="suggestion-author">👤 ${escapeHtml(suggestion.name)}</span>
                <span class="suggestion-date">${formattedDate}</span>
            </div>
            <div class="suggestion-text">${escapeHtml(suggestion.suggestion)}</div>
        `;
        
        suggestionsList.appendChild(item);
    });
}

// Load suggestions on page load
if (document.getElementById('suggestionsList')) {
    loadSuggestions();
}

