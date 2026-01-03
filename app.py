from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
import tempfile
from werkzeug.utils import secure_filename
import PyPDF2
from PIL import Image
import io
import zipfile
from pdf2image import convert_from_path
import fitz  # PyMuPDF
import json
from datetime import datetime

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)
MAX_FILE_SIZE_KB = 900000  # 900000 KB
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_KB * 1024  # 900000 KB max upload size

UPLOAD_FOLDER = 'uploads'
COMPRESSED_FOLDER = 'compressed'
FORUM_DATA_FILE = 'forum_data.json'
SUGGESTIONS_FILE = 'suggestions.json'
MAX_FILE_SIZE = MAX_FILE_SIZE_KB * 1024  # 900000 KB
TARGET_SIZE = 100 * 1024 * 1024  # 100MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(COMPRESSED_FOLDER, exist_ok=True)

# Initialize forum data file if it doesn't exist
if not os.path.exists(FORUM_DATA_FILE):
    with open(FORUM_DATA_FILE, 'w') as f:
        json.dump({'posts': []}, f)

# Initialize suggestions file if it doesn't exist
if not os.path.exists(SUGGESTIONS_FILE):
    with open(SUGGESTIONS_FILE, 'w') as f:
        json.dump({'suggestions': []}, f)

ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def compress_pdf_advanced(input_path, output_path, target_size):
    """Advanced PDF compression using multiple strategies"""
    try:
        # Strategy 1: Try PyMuPDF compression (most effective)
        doc = fitz.open(input_path)
        
        # Get initial size
        initial_size = os.path.getsize(input_path)
        
        # If already small enough, just copy
        if initial_size <= target_size:
            doc.save(output_path)
            doc.close()
            return True
        
        # Try different compression levels
        compression_levels = [
            (fitz.PDF_REF_XOBJECT, 0.5),  # Image compression 50%
            (fitz.PDF_REF_XOBJECT, 0.3),  # Image compression 30%
            (fitz.PDF_REF_XOBJECT, 0.2),  # Image compression 20%
        ]
        
        for compression_type, image_quality in compression_levels:
            # Compress images in the PDF
            for page_num in range(len(doc)):
                page = doc[page_num]
                image_list = page.get_images()
                
                for img_index, img in enumerate(image_list):
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    # Convert to PIL Image and compress
                    img_pil = Image.open(io.BytesIO(image_bytes))
                    
                    # Convert RGBA to RGB if needed
                    if img_pil.mode == 'RGBA':
                        rgb_img = Image.new('RGB', img_pil.size, (255, 255, 255))
                        rgb_img.paste(img_pil, mask=img_pil.split()[3])
                        img_pil = rgb_img
                    
                    # Compress image
                    output_buffer = io.BytesIO()
                    img_pil.save(output_buffer, format='JPEG', quality=int(image_quality * 100), optimize=True)
                    output_buffer.seek(0)
                    
                    # Replace image in PDF
                    doc._replace_image(xref, stream=output_buffer.read())
            
            # Save with compression
            doc.save(output_path, garbage=4, deflate=True, clean=True)
            
            # Check if we've reached target size
            compressed_size = os.path.getsize(output_path)
            if compressed_size <= target_size:
                doc.close()
                return True
            
            # If still too large, try next compression level
            if image_quality > 0.2:
                continue
        
        doc.close()
        
        # Strategy 2: If still too large, try removing metadata and further optimization
        doc = fitz.open(output_path)
        doc.save(output_path, garbage=4, deflate=True, clean=True, ascii=False)
        doc.close()
        
        # Final check
        final_size = os.path.getsize(output_path)
        if final_size <= target_size:
            return True
        
        # If still too large, return the best compression we achieved
        return True
        
    except Exception as e:
        print(f"PyMuPDF compression failed: {e}")
        # Fallback to PyPDF2
        try:
            return compress_pdf_basic(input_path, output_path)
        except Exception as e2:
            print(f"PyPDF2 compression also failed: {e2}")
            return False

def compress_pdf_basic(input_path, output_path):
    """Basic PDF compression using PyPDF2"""
    try:
        with open(input_path, 'rb') as input_file:
            pdf_reader = PyPDF2.PdfReader(input_file)
            pdf_writer = PyPDF2.PdfWriter()
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                page.compress_content_streams()
                pdf_writer.add_page(page)
            
            with open(output_path, 'wb') as output_file:
                pdf_writer.write(output_file)
            
            return True
    except Exception as e:
        print(f"Basic compression failed: {e}")
        return False

def merge_pdfs(file_paths, output_path):
    """Merge multiple PDF files into one"""
    try:
        if not file_paths or len(file_paths) < 2:
            print("Not enough files to merge")
            return False
        
        pdf_writer = PyPDF2.PdfWriter()
        pages_added = 0
        
        for file_path in file_paths:
            if not os.path.exists(file_path):
                print(f"File not found: {file_path}")
                continue
            
            try:
                with open(file_path, 'rb') as input_file:
                    pdf_reader = PyPDF2.PdfReader(input_file)
                    
                    if len(pdf_reader.pages) == 0:
                        print(f"PDF has no pages: {file_path}")
                        continue
                    
                    # Add all pages from this PDF
                    for page_num in range(len(pdf_reader.pages)):
                        try:
                            page = pdf_reader.pages[page_num]
                            pdf_writer.add_page(page)
                            pages_added += 1
                        except Exception as e:
                            print(f"Error adding page {page_num} from {file_path}: {e}")
                            continue
            except Exception as e:
                print(f"Error reading PDF {file_path}: {e}")
                continue
        
        if pages_added == 0:
            print("No pages were added to the merged PDF")
            return False
        
        # Write merged PDF
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'wb') as output_file:
            pdf_writer.write(output_file)
        
        if not os.path.exists(output_path):
            print("Output file was not created")
            return False
        
        return True
    except Exception as e:
        print(f"PDF merge failed: {e}")
        import traceback
        traceback.print_exc()
        return False

@app.route('/')
def index():
    return send_file('index.html')

@app.route('/compress', methods=['POST'])
def compress_pdf():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only PDF files are allowed.'}), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        input_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(input_path)
        
        # Check file size
        file_size = os.path.getsize(input_path)
        if file_size > MAX_FILE_SIZE:
            os.remove(input_path)
            return jsonify({'error': f'File too large. Maximum size is {MAX_FILE_SIZE_KB:,} KB ({MAX_FILE_SIZE / (1024*1024):.1f} MB)'}), 400
        
        # Generate output filename
        base_name = os.path.splitext(filename)[0]
        output_filename = f"{base_name}_compressed.pdf"
        output_path = os.path.join(COMPRESSED_FOLDER, output_filename)
        
        # Compress PDF
        success = compress_pdf_advanced(input_path, output_path, TARGET_SIZE)
        
        if not success:
            os.remove(input_path)
            return jsonify({'error': 'Compression failed'}), 500
        
        # Get file sizes
        original_size = os.path.getsize(input_path)
        compressed_size = os.path.getsize(output_path)
        compression_ratio = (1 - compressed_size / original_size) * 100
        
        # Clean up input file
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

@app.route('/test-merge-route', methods=['GET'])
def test_merge_route():
    """Test endpoint to verify merge route is accessible"""
    return jsonify({'status': 'merge route is accessible', 'message': 'Routing is working correctly'})

@app.route('/merge', methods=['POST'])
def merge_pdfs_endpoint():
    file_paths = []
    try:
        # Log request for debugging
        print(f"[MERGE] Request received - Content-Type: {request.content_type}, Files: {len(request.files)}")
        
        if 'files' not in request.files:
            print("[MERGE] Error: No 'files' key in request.files")
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        print(f"[MERGE] Processing {len(files)} files")
        
        if not files or len(files) == 0:
            return jsonify({'error': 'No files provided'}), 400
        
        # Validate and save all files
        total_size = 0
        
        for file in files:
            if not file or file.filename == '':
                continue
            
            if not allowed_file(file.filename):
                # Clean up already saved files
                for path in file_paths:
                    if os.path.exists(path):
                        try:
                            os.remove(path)
                        except:
                            pass
                return jsonify({'error': 'Invalid file type. Only PDF files are allowed.'}), 400
            
            try:
                # Save uploaded file
                filename = secure_filename(file.filename)
                if not filename:
                    continue
                    
                input_path = os.path.join(UPLOAD_FOLDER, f"merge_{len(file_paths)}_{filename}")
                file.save(input_path)
                
                # Check file size
                if not os.path.exists(input_path):
                    continue
                    
                file_size = os.path.getsize(input_path)
                total_size += file_size
                
                if file_size > MAX_FILE_SIZE:
                    # Clean up already saved files
                    for path in file_paths:
                        if os.path.exists(path):
                            try:
                                os.remove(path)
                            except:
                                pass
                    if os.path.exists(input_path):
                        try:
                            os.remove(input_path)
                        except:
                            pass
                    return jsonify({'error': f'One or more files are too large. Maximum size per file is {MAX_FILE_SIZE_KB:,} KB'}), 400
                
                file_paths.append(input_path)
            except Exception as e:
                print(f"Error processing file {file.filename}: {e}")
                continue
        
        if len(file_paths) < 2:
            # Clean up files
            for path in file_paths:
                if os.path.exists(path):
                    try:
                        os.remove(path)
                    except:
                        pass
            return jsonify({'error': 'Please upload at least 2 valid PDF files'}), 400
        
        # Generate output filename
        output_filename = f"merged_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_path = os.path.join(COMPRESSED_FOLDER, output_filename)
        
        # Merge PDFs
        success = merge_pdfs(file_paths, output_path)
        
        # Clean up input files
        for path in file_paths:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
        
        if not success:
            if os.path.exists(output_path):
                try:
                    os.remove(output_path)
                except:
                    pass
            return jsonify({'error': 'Merge failed. Please ensure all files are valid PDFs.'}), 500
        
        if not os.path.exists(output_path):
            return jsonify({'error': 'Merge failed. Output file was not created.'}), 500
        
        # Get merged file size
        merged_size = os.path.getsize(output_path)
        
        print(f"[MERGE] Success - Merged {len(file_paths)} files into {output_filename} ({merged_size} bytes)")
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'total_size': total_size,
            'merged_size': merged_size,
            'file_count': len(file_paths)
        })
    
    except Exception as e:
        # Clean up any remaining files
        for path in file_paths:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
        print(f"[MERGE] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    try:
        file_path = os.path.join(COMPRESSED_FOLDER, secure_filename(filename))
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True)
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cleanup/<filename>', methods=['DELETE'])
def cleanup_file(filename):
    try:
        file_path = os.path.join(COMPRESSED_FOLDER, secure_filename(filename))
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/suggestions', methods=['POST'])
def submit_suggestion():
    try:
        # Check if request has JSON data
        if not request.is_json:
            # Try to get JSON from request anyway (some clients don't set header correctly)
            try:
                data = request.get_json(force=True)
            except:
                return jsonify({'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        name = data.get('name', 'Anonymous') or 'Anonymous'
        email = data.get('email', '') or ''
        suggestion = data.get('suggestion', '') or ''
        
        if not suggestion or not suggestion.strip():
            return jsonify({'error': 'Suggestion text is required'}), 400
        
        # Ensure suggestions file exists and has correct structure
        if not os.path.exists(SUGGESTIONS_FILE):
            with open(SUGGESTIONS_FILE, 'w') as f:
                json.dump({'suggestions': []}, f)
        
        # Load existing suggestions
        try:
            with open(SUGGESTIONS_FILE, 'r') as f:
                suggestions_data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            suggestions_data = {'suggestions': []}
        
        if 'suggestions' not in suggestions_data:
            suggestions_data['suggestions'] = []
        
        # Add new suggestion
        new_suggestion = {
            'id': len(suggestions_data['suggestions']) + 1,
            'name': name.strip(),
            'email': email.strip(),
            'suggestion': suggestion.strip(),
            'timestamp': datetime.now().isoformat()
        }
        
        suggestions_data['suggestions'].append(new_suggestion)
        
        # Save suggestions
        try:
            with open(SUGGESTIONS_FILE, 'w') as f:
                json.dump(suggestions_data, f, indent=2)
        except Exception as e:
            print(f"Error saving suggestion: {e}")
            return jsonify({'error': 'Failed to save suggestion'}), 500
        
        return jsonify({'success': True, 'message': 'Thank you for your suggestion!'})
    
    except Exception as e:
        print(f"Suggestion error: {e}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/suggestions', methods=['GET'])
def get_suggestions():
    try:
        if not os.path.exists(SUGGESTIONS_FILE):
            return jsonify({'suggestions': []})
        
        with open(SUGGESTIONS_FILE, 'r') as f:
            suggestions_data = json.load(f)
        
        # Return suggestions in reverse order (newest first), limit to 10
        suggestions = suggestions_data.get('suggestions', [])
        suggestions.reverse()
        return jsonify({'suggestions': suggestions[:10]})
    
    except Exception as e:
        print(f"Error loading suggestions: {e}")
        return jsonify({'suggestions': []})

@app.route('/forum/posts', methods=['GET'])
def get_posts():
    try:
        with open(FORUM_DATA_FILE, 'r') as f:
            forum_data = json.load(f)
        
        # Return posts in reverse order (newest first)
        posts = forum_data.get('posts', [])
        posts.reverse()
        return jsonify({'posts': posts})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/forum/posts', methods=['POST'])
def create_post():
    try:
        data = request.get_json()
        author = data.get('author', 'Anonymous')
        title = data.get('title', '')
        content = data.get('content', '')
        
        if not title or not content:
            return jsonify({'error': 'Title and content are required'}), 400
        
        # Load existing posts
        with open(FORUM_DATA_FILE, 'r') as f:
            forum_data = json.load(f)
        
        # Create new post
        new_post = {
            'id': len(forum_data['posts']) + 1,
            'author': author,
            'title': title,
            'content': content,
            'timestamp': datetime.now().isoformat(),
            'comments': []
        }
        
        forum_data['posts'].append(new_post)
        
        # Save posts
        with open(FORUM_DATA_FILE, 'w') as f:
            json.dump(forum_data, f, indent=2)
        
        return jsonify({'success': True, 'post': new_post})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/forum/posts/<int:post_id>/comments', methods=['POST'])
def add_comment(post_id):
    try:
        data = request.get_json()
        author = data.get('author', 'Anonymous')
        content = data.get('content', '')
        
        if not content:
            return jsonify({'error': 'Comment content is required'}), 400
        
        # Load existing posts
        with open(FORUM_DATA_FILE, 'r') as f:
            forum_data = json.load(f)
        
        # Find post
        post = None
        for p in forum_data['posts']:
            if p['id'] == post_id:
                post = p
                break
        
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        # Add comment
        new_comment = {
            'id': len(post['comments']) + 1,
            'author': author,
            'content': content,
            'timestamp': datetime.now().isoformat()
        }
        
        post['comments'].append(new_comment)
        
        # Save posts
        with open(FORUM_DATA_FILE, 'w') as f:
            json.dump(forum_data, f, indent=2)
        
        return jsonify({'success': True, 'comment': new_comment})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/forum')
def forum_page():
    return send_file('forum.html')

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

@app.route('/<path:path>')
def serve_static(path):
    if path in ['styles.css', 'script.js', 'forum.js']:
        return send_from_directory('.', path)
    if path == 'forum.html':
        return send_file('forum.html')
    return send_file('index.html')

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': f'File too large. Maximum size is {MAX_FILE_SIZE_KB:,} KB'}), 413

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'An internal error occurred. Please try again.'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

