# PDF Compressor Website

A web application that allows users to compress PDF files up to 1GB down to 100MB.

## Features

- Upload PDFs up to 1GB
- Advanced compression algorithms
- Drag-and-drop file upload
- Real-time compression progress
- Download compressed PDFs
- Modern, responsive UI

## Installation

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install system dependencies (for pdf2image):**
   - **Windows:** Install [poppler](https://github.com/oschwartz10612/poppler-windows/releases/) and add to PATH
   - **macOS:** `brew install poppler`
   - **Linux:** `sudo apt-get install poppler-utils`

## Running the Application

1. **Start the Flask server:**
   ```bash
   python app.py
   ```

2. **Open your browser:**
   Navigate to `http://localhost:5000`

## How It Works

The application uses multiple compression strategies:
1. **PyMuPDF (fitz)**: Advanced PDF compression with image optimization
2. **Image compression**: Reduces image quality within PDFs
3. **Metadata removal**: Cleans up unnecessary PDF metadata
4. **Fallback**: Uses PyPDF2 for basic compression if advanced methods fail

## File Structure

- `app.py` - Flask backend server
- `index.html` - Frontend HTML
- `styles.css` - Styling
- `script.js` - Frontend JavaScript
- `requirements.txt` - Python dependencies
- `uploads/` - Temporary upload directory (auto-created)
- `compressed/` - Compressed PDFs directory (auto-created)

## Notes

- Files are temporarily stored on the server during processing
- Compressed files are stored until manually deleted or server restart
- For production use, consider implementing automatic cleanup and file size limits

## License

MIT License

