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

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

UPLOAD_FOLDER = 'uploads'
COMPRESSED_FOLDER = 'compressed'
MAX_FILE_SIZE = 2000 * 1024 * 1024  # 2000MB
TARGET_SIZE = 100 * 1024 * 1024  # 100MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(COMPRESSED_FOLDER, exist_ok=True)

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

@app.route('/')
def index():
    return send_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    if path in ['styles.css', 'script.js']:
        return send_from_directory('.', path)
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
            return jsonify({'error': f'File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024)}MB'}), 400
        
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

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

