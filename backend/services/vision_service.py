import cv2
import numpy as np
from PIL import Image

def detect_shapes(pil_image: Image.Image) -> dict:
    img = np.array(pil_image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5,5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    shapes = {'lines': 0, 'rectangles': 0, 'circles': 0, 'contours': len(contours)}
    for cnt in contours:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
        if len(approx) == 2:
            shapes['lines'] += 1
        elif len(approx) == 3:
            pass
        elif len(approx) == 4:
            shapes['rectangles'] += 1
        elif len(approx) > 5:
            shapes['circles'] += 1
    return shapes
