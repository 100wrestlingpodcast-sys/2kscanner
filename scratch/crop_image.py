import sys
import os
from PIL import Image

def main():
    image_path = '/Users/albertoaliceahernandez/.gemini/antigravity/brain/dbeedbc5-4bdf-42e6-9f34-4822ee864a65/media__1779886873315.png'
    if not os.path.exists(image_path):
        print("Image does not exist!")
        return

    img = Image.open(image_path)
    width, height = img.size
    print(f"Original image size: {width}x{height}")

    # Let's simulate a crop based on our CropTool math
    # Suppose container width=800, container height=500
    container_width = 800
    container_height = 500
    
    # Image aspect ratio is 16:9
    image_aspect = width / height
    container_aspect = container_width / container_height
    
    # displayWidth and displayHeight
    if image_aspect > container_aspect:
        display_height = container_width / image_aspect
        display_width = container_width
    else:
        display_width = container_height * image_aspect
        display_height = container_height

    # Let's say zoom = 1, position = {x: 0, y: 0}
    zoom = 1
    position_x = 0
    position_y = 0
    
    rendered_width = display_width * zoom
    rendered_height = display_height * zoom
    
    offset_x = (container_width - rendered_width) / 2 + position_x
    offset_y = (container_height - rendered_height) / 2 + position_y
    
    # Crop Area as shown in the screenshot:
    # x=30, y=32, width=54, height=33
    crop_area = {
        'x': 30,
        'y': 32,
        'width': 54,
        'height': 33
    }
    
    crop_x_pixel = (crop_area['x'] / 100) * container_width
    crop_y_pixel = (crop_area['y'] / 100) * container_height
    crop_width_pixel = (crop_area['width'] / 100) * container_width
    crop_height_pixel = (crop_area['height'] / 100) * container_height
    
    source_x = ((crop_x_pixel - offset_x) / rendered_width) * width
    source_y = ((crop_y_pixel - offset_y) / rendered_height) * height
    source_width = (crop_width_pixel / rendered_width) * width
    source_height = (crop_height_pixel / rendered_height) * height
    
    # Clamp
    source_x = max(0, min(width, source_x))
    source_y = max(0, min(height, source_y))
    source_width = max(10, min(width - source_x, source_width))
    source_height = max(10, min(height - source_y, source_height))
    
    print(f"Calculated source crop: x={source_x}, y={source_y}, w={source_width}, h={source_height}")
    
    cropped_img = img.crop((source_x, source_y, source_x + source_width, source_y + source_height))
    cropped_img = cropped_img.convert("RGB")
    output_path = '/Users/albertoaliceahernandez/.gemini/antigravity/scratch/app-scanner-2k/public/test_cropped_output.jpg'
    cropped_img.save(output_path, "JPEG", quality=95)
    print(f"Cropped image saved to {output_path}")

if __name__ == '__main__':
    main()
