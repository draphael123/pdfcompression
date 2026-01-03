// Load posts on page load
document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    
    // Handle new post form
    document.getElementById('new-post-form').addEventListener('submit', handleNewPost);
});

function loadPosts() {
    fetch('/forum/posts')
        .then(response => response.json())
        .then(data => {
            displayPosts(data.posts || []);
        })
        .catch(error => {
            console.error('Error loading posts:', error);
            document.getElementById('posts-container').innerHTML = 
                '<div class="empty-state"><div class="empty-state-icon">😕</div><p>Failed to load posts. Please refresh the page.</p></div>';
        });
}

function displayPosts(posts) {
    const container = document.getElementById('posts-container');
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <h3>No posts yet</h3>
                <p>Be the first to start a discussion!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    posts.forEach(post => {
        const postCard = createPostCard(post);
        container.appendChild(postCard);
    });
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    const commentsHtml = post.comments && post.comments.length > 0
        ? post.comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <span><strong>${escapeHtml(comment.author)}</strong></span>
                    <span>${formatDate(comment.timestamp)}</span>
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
            </div>
        `).join('')
        : '<p style="color: #999; font-style: italic;">No comments yet.</p>';
    
    card.innerHTML = `
        <div class="post-header">
            <div>
                <h3 class="post-title">${escapeHtml(post.title)}</h3>
                <div class="post-meta">
                    By <strong>${escapeHtml(post.author)}</strong> • ${formatDate(post.timestamp)}
                </div>
            </div>
        </div>
        <div class="post-content">${escapeHtml(post.content)}</div>
        <div class="comments-section">
            <h4 style="color: #667eea; margin-bottom: 15px;">Comments (${post.comments ? post.comments.length : 0})</h4>
            <div class="comments-list">
                ${commentsHtml}
            </div>
            <div class="comment-form">
                <input type="text" id="comment-author-${post.id}" placeholder="Your Name (optional)" class="form-input" style="margin-bottom: 10px;">
                <textarea id="comment-content-${post.id}" placeholder="Write a comment..." class="form-textarea" style="min-height: 80px; margin-bottom: 10px;"></textarea>
                <button class="submit-btn" onclick="addComment(${post.id})" style="width: auto; padding: 10px 30px;">Add Comment</button>
            </div>
        </div>
    `;
    
    return card;
}

function handleNewPost(e) {
    e.preventDefault();
    
    const author = document.getElementById('post-author').value.trim() || 'Anonymous';
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    
    if (!title || !content) {
        showMessage('Please fill in both title and content', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    
    fetch('/forum/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ author, title, content })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage('Post created successfully!', 'success');
            e.target.reset();
            loadPosts();
        } else {
            showMessage(data.error || 'Failed to create post', 'error');
        }
    })
    .catch(error => {
        showMessage('An error occurred. Please try again.', 'error');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Post';
    });
}

function addComment(postId) {
    const authorInput = document.getElementById(`comment-author-${postId}`);
    const contentInput = document.getElementById(`comment-content-${postId}`);
    
    const author = authorInput.value.trim() || 'Anonymous';
    const content = contentInput.value.trim();
    
    if (!content) {
        alert('Please enter a comment');
        return;
    }
    
    fetch(`/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ author, content })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            authorInput.value = '';
            contentInput.value = '';
            loadPosts();
        } else {
            alert(data.error || 'Failed to add comment');
        }
    })
    .catch(error => {
        alert('An error occurred. Please try again.');
    });
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('post-message');
    messageDiv.textContent = message;
    messageDiv.className = `suggestion-message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
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
