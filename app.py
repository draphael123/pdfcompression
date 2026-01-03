from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
from datetime import datetime
from werkzeug.utils import secure_filename
import PyPDF2

# Try to import PyMuPDF, fallback gracefully if unavailable
try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

app = Flask(__name__)
CORS(app)

# Configuration
MAX_FILE_SIZE_KB = 900000  # 900MB
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_KB * 1024
MAX_FILE_SIZE = MAX_FILE_SIZE_KB * 1024
TARGET_SIZE = 100 * 1024 * 1024  # 100MB target

# Serverless-compatible paths
def get_base_dir():
    """Get base directory - works in both local and serverless environments"""
    if os.path.exists('/tmp'):
        return '/tmp'
    return os.path.dirname(os.path.abspath(__file__))

def get_upload_folder():
    return os.path.join(get_base_dir(), 'uploads')

def get_compressed_folder():
    return os.path.join(get_base_dir(), 'compressed')

def get_data_file(filename):
    return os.path.join(get_base_dir(), filename)

# Initialize directories
def ensure_directories():
    try:
        os.makedirs(get_upload_folder(), exist_ok=True)
        os.makedirs(get_compressed_folder(), exist_ok=True)
    except Exception as e:
        print(f"Warning: Could not create directories: {e}")

def ensure_data_files():
    try:
        forum_file = get_data_file('forum_data.json')
        if not os.path.exists(forum_file):
            with open(forum_file, 'w') as f:
                json.dump({'posts': []}, f)
    except Exception as e:
        print(f"Warning: Could not initialize forum data: {e}")
    
    try:
        suggestions_file = get_data_file('suggestions.json')
        if not os.path.exists(suggestions_file):
            with open(suggestions_file, 'w') as f:
                json.dump({'suggestions': []}, f)
    except Exception as e:
        print(f"Warning: Could not initialize suggestions: {e}")

# Helper functions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'pdf'

def compress_pdf(input_path, output_path, target_size):
    """Compress PDF using available libraries"""
    if HAS_PYMUPDF:
        try:
            return compress_pdf_advanced(input_path, output_path, target_size)
        except Exception as e:
            print(f"PyMuPDF compression failed: {e}")
    
    # Fallback to PyPDF2
    try:
        return compress_pdf_basic(input_path, output_path)
    except Exception as e:
        print(f"PyPDF2 compression failed: {e}")
        return False

def compress_pdf_advanced(input_path, output_path, target_size):
    """Advanced compression using PyMuPDF"""
    if not HAS_PYMUPDF:
        return False
    
    doc = fitz.open(input_path)
    initial_size = os.path.getsize(input_path)
    
    if initial_size <= target_size:
        doc.save(output_path)
        doc.close()
        return True
    
    # Try compression
    doc.save(output_path, garbage=4, deflate=True, clean=True)
    doc.close()
    return True

def compress_pdf_basic(input_path, output_path):
    """Basic compression using PyPDF2"""
    with open(input_path, 'rb') as input_file:
        pdf_reader = PyPDF2.PdfReader(input_file)
        pdf_writer = PyPDF2.PdfWriter()
        
        for page in pdf_reader.pages:
            page.compress_content_streams()
            pdf_writer.add_page(page)
        
        with open(output_path, 'wb') as output_file:
            pdf_writer.write(output_file)
    
    return True

def merge_pdfs(file_paths, output_path):
    """Merge multiple PDFs into one"""
    pdf_writer = PyPDF2.PdfWriter()
    
    for file_path in file_paths:
        if not os.path.exists(file_path):
            continue
        
        try:
            with open(file_path, 'rb') as input_file:
                pdf_reader = PyPDF2.PdfReader(input_file)
                for page in pdf_reader.pages:
                    pdf_writer.add_page(page)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            continue
    
    if len(pdf_writer.pages) == 0:
        return False
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as output_file:
        pdf_writer.write(output_file)
    
    return True

# API Routes
@app.route('/compress', methods=['POST'])
def compress_pdf_endpoint():
    ensure_directories()
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file. Only PDF files are allowed.'}), 400
        
        filename = secure_filename(file.filename)
        input_path = os.path.join(get_upload_folder(), filename)
        file.save(input_path)
        
        file_size = os.path.getsize(input_path)
        if file_size > MAX_FILE_SIZE:
            os.remove(input_path)
            return jsonify({'error': f'File too large. Maximum size is {MAX_FILE_SIZE_KB:,} KB'}), 400
        
        base_name = os.path.splitext(filename)[0]
        output_filename = f"{base_name}_compressed.pdf"
        output_path = os.path.join(get_compressed_folder(), output_filename)
        
        success = compress_pdf(input_path, output_path, TARGET_SIZE)
        
        if not success:
            os.remove(input_path)
            return jsonify({'error': 'Compression failed'}), 500
        
        original_size = os.path.getsize(input_path)
        compressed_size = os.path.getsize(output_path)
        compression_ratio = (1 - compressed_size / original_size) * 100
        
        os.remove(input_path)
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'original_size': original_size,
            'compressed_size': compressed_size,
            'compression_ratio': round(compression_ratio, 2)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/merge', methods=['POST'])
def merge_pdfs_endpoint():
    ensure_directories()
    file_paths = []
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        if len(files) < 2:
            return jsonify({'error': 'Please upload at least 2 PDF files'}), 400
        
        for file in files:
            if not file or file.filename == '' or not allowed_file(file.filename):
                continue
            
            filename = secure_filename(file.filename)
            input_path = os.path.join(get_upload_folder(), f"merge_{len(file_paths)}_{filename}")
            file.save(input_path)
            
            file_size = os.path.getsize(input_path)
            if file_size > MAX_FILE_SIZE:
                for path in file_paths:
                    if os.path.exists(path):
                        os.remove(path)
                if os.path.exists(input_path):
                    os.remove(input_path)
                return jsonify({'error': 'One or more files are too large'}), 400
            
            file_paths.append(input_path)
        
        if len(file_paths) < 2:
            for path in file_paths:
                if os.path.exists(path):
                    os.remove(path)
            return jsonify({'error': 'Please upload at least 2 valid PDF files'}), 400
        
        output_filename = f"merged_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_path = os.path.join(get_compressed_folder(), output_filename)
        
        success = merge_pdfs(file_paths, output_path)
        
        for path in file_paths:
            if os.path.exists(path):
                os.remove(path)
        
        if not success:
            if os.path.exists(output_path):
                os.remove(output_path)
            return jsonify({'error': 'Merge failed'}), 500
        
        merged_size = os.path.getsize(output_path)
        total_size = sum(os.path.getsize(p) for p in file_paths if os.path.exists(p))
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'total_size': total_size,
            'merged_size': merged_size,
            'file_count': len(file_paths)
        })
    except Exception as e:
        for path in file_paths:
            if os.path.exists(path):
                os.remove(path)
        return jsonify({'error': str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    try:
        file_path = os.path.join(get_compressed_folder(), secure_filename(filename))
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True)
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/suggestions', methods=['GET', 'POST'])
def suggestions():
    ensure_data_files()
    suggestions_file = get_data_file('suggestions.json')
    
    if request.method == 'POST':
        try:
            data = request.get_json() or {}
            name = data.get('name', 'Anonymous') or 'Anonymous'
            email = data.get('email', '') or ''
            suggestion = data.get('suggestion', '') or ''
            
            if not suggestion.strip():
                return jsonify({'error': 'Suggestion text is required'}), 400
            
            if not os.path.exists(suggestions_file):
                with open(suggestions_file, 'w') as f:
                    json.dump({'suggestions': []}, f)
            
            with open(suggestions_file, 'r') as f:
                suggestions_data = json.load(f)
            
            new_suggestion = {
                'id': len(suggestions_data.get('suggestions', [])) + 1,
                'name': name.strip(),
                'email': email.strip(),
                'suggestion': suggestion.strip(),
                'timestamp': datetime.now().isoformat()
            }
            
            suggestions_data.setdefault('suggestions', []).append(new_suggestion)
            
            with open(suggestions_file, 'w') as f:
                json.dump(suggestions_data, f, indent=2)
            
            return jsonify({'success': True, 'message': 'Thank you for your suggestion!'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # GET request
    try:
        if not os.path.exists(suggestions_file):
            return jsonify({'suggestions': []})
        
        with open(suggestions_file, 'r') as f:
            suggestions_data = json.load(f)
        
        suggestions_list = suggestions_data.get('suggestions', [])
        suggestions_list.reverse()
        return jsonify({'suggestions': suggestions_list[:10]})
    except Exception as e:
        return jsonify({'suggestions': []})

@app.route('/forum/posts', methods=['GET', 'POST'])
def forum_posts():
    ensure_data_files()
    forum_file = get_data_file('forum_data.json')
    
    if request.method == 'POST':
        try:
            data = request.get_json() or {}
            author = data.get('author', 'Anonymous') or 'Anonymous'
            title = data.get('title', '') or ''
            content = data.get('content', '') or ''
            
            if not title or not content:
                return jsonify({'error': 'Title and content are required'}), 400
            
            with open(forum_file, 'r') as f:
                forum_data = json.load(f)
            
            new_post = {
                'id': len(forum_data.get('posts', [])) + 1,
                'author': author,
                'title': title,
                'content': content,
                'timestamp': datetime.now().isoformat(),
                'comments': []
            }
            
            forum_data.setdefault('posts', []).append(new_post)
            
            with open(forum_file, 'w') as f:
                json.dump(forum_data, f, indent=2)
            
            return jsonify({'success': True, 'post': new_post})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # GET request
    try:
        with open(forum_file, 'r') as f:
            forum_data = json.load(f)
        
        posts = forum_data.get('posts', [])
        posts.reverse()
        return jsonify({'posts': posts})
    except Exception as e:
        return jsonify({'posts': []})

@app.route('/forum/posts/<int:post_id>/comments', methods=['POST'])
def add_comment(post_id):
    ensure_data_files()
    forum_file = get_data_file('forum_data.json')
    
    try:
        data = request.get_json() or {}
        author = data.get('author', 'Anonymous') or 'Anonymous'
        content = data.get('content', '') or ''
        
        if not content:
            return jsonify({'error': 'Comment content is required'}), 400
        
        with open(forum_file, 'r') as f:
            forum_data = json.load(f)
        
        post = None
        for p in forum_data.get('posts', []):
            if p.get('id') == post_id:
                post = p
                break
        
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        new_comment = {
            'id': len(post.get('comments', [])) + 1,
            'author': author,
            'content': content,
            'timestamp': datetime.now().isoformat()
        }
        
        post.setdefault('comments', []).append(new_comment)
        
        with open(forum_file, 'w') as f:
            json.dump(forum_data, f, indent=2)
        
        return jsonify({'success': True, 'comment': new_comment})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

# Static file serving for serverless
def serve_static_file(filename):
    """Serve static files in serverless environment"""
    try:
        possible_paths = [
            filename,
            os.path.join(os.path.dirname(os.path.abspath(__file__)), filename),
        ]
        
        for file_path in possible_paths:
            if os.path.exists(file_path):
                content_type = {
                    '.html': 'text/html',
                    '.css': 'text/css',
                    '.js': 'application/javascript',
                    '.json': 'application/json'
                }.get(os.path.splitext(filename)[1].lower(), 'text/plain')
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return content, 200, {'Content-Type': content_type}
        
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return serve_static_file('index.html')

@app.route('/forum.html')
def forum():
    return serve_static_file('forum.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if filename.endswith(('.css', '.js', '.html', '.json')):
        return serve_static_file(filename)
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': f'File too large. Maximum size is {MAX_FILE_SIZE_KB:,} KB'}), 413

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'An internal error occurred. Please try again.'}), 500

# Export for Vercel
handler = app

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
