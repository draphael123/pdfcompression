const newPostForm = document.getElementById('newPostForm');
const postsContainer = document.getElementById('postsContainer');
const postMessage = document.getElementById('postMessage');

// Load posts on page load
loadPosts();

// Handle new post submission
newPostForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const author = document.getElementById('postAuthor').value || 'Anonymous';
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    
    if (!title || !content) {
        showMessage('Please fill in all required fields.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/forum/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ author, title, content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Post created successfully!', 'success');
            newPostForm.reset();
            loadPosts();
        } else {
            showMessage(data.error || 'Failed to create post.', 'error');
        }
    } catch (error) {
        showMessage('An error occurred: ' + error.message, 'error');
    }
});

// Load all posts
async function loadPosts() {
    try {
        const response = await fetch('/forum/posts');
        const data = await response.json();
        
        if (data.posts && data.posts.length > 0) {
            displayPosts(data.posts);
        } else {
            postsContainer.innerHTML = '<div class="no-posts">No posts yet. Be the first to post!</div>';
        }
    } catch (error) {
        postsContainer.innerHTML = '<div class="error">Failed to load posts. Please try again later.</div>';
    }
}

// Display posts
function displayPosts(posts) {
    postsContainer.innerHTML = '';
    
    posts.forEach(post => {
        const postElement = createPostElement(post);
        postsContainer.appendChild(postElement);
    });
}

// Create post element
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'forum-post';
    
    const timestamp = new Date(post.timestamp).toLocaleString();
    
    postDiv.innerHTML = `
        <div class="post-header">
            <div class="post-author">👤 ${post.author}</div>
            <div class="post-date">${timestamp}</div>
        </div>
        <h3 class="post-title">${escapeHtml(post.title)}</h3>
        <p class="post-content">${escapeHtml(post.content)}</p>
        <div class="comments-section">
            <h4 class="comments-title">Comments (${post.comments.length})</h4>
            <div class="comments-list" id="comments-${post.id}">
                ${post.comments.map(comment => createCommentHTML(comment)).join('')}
            </div>
            <form class="comment-form" onsubmit="addComment(event, ${post.id})">
                <input type="text" placeholder="Your name (optional)" class="comment-author-input">
                <textarea placeholder="Write a comment..." class="comment-content-input" required></textarea>
                <button type="submit" class="submit-comment-btn">Add Comment</button>
            </form>
        </div>
    `;
    
    return postDiv;
}

// Create comment HTML
function createCommentHTML(comment) {
    const timestamp = new Date(comment.timestamp).toLocaleString();
    return `
        <div class="comment">
            <div class="comment-header">
                <span class="comment-author">👤 ${escapeHtml(comment.author)}</span>
                <span class="comment-date">${timestamp}</span>
            </div>
            <p class="comment-content">${escapeHtml(comment.content)}</p>
        </div>
    `;
}

// Add comment
async function addComment(event, postId) {
    event.preventDefault();
    
    const form = event.target;
    const author = form.querySelector('.comment-author-input').value || 'Anonymous';
    const content = form.querySelector('.comment-content-input').value;
    
    if (!content) {
        return;
    }
    
    try {
        const response = await fetch(`/forum/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ author, content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            form.querySelector('.comment-content-input').value = '';
            form.querySelector('.comment-author-input').value = '';
            loadPosts();
        } else {
            alert(data.error || 'Failed to add comment.');
        }
    } catch (error) {
        alert('An error occurred: ' + error.message);
    }
}

// Show message
function showMessage(message, type) {
    postMessage.textContent = message;
    postMessage.className = `post-message ${type}`;
    postMessage.style.display = 'block';
    
    setTimeout(() => {
        postMessage.style.display = 'none';
    }, 5000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

