import pytesseract
from PIL import Image

def extract_text(image: Image.Image) -> str:
    try:
        text = pytesseract.image_to_string(image)
        return text.strip() if text else 'No readable text found.'
    except Exception as e:
        return f'OCR error: {e}'
