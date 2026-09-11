import os
from rembg import remove
from PIL import Image

image_dir = 'Frontend/images'

images = ['slide1.png', 'slide2.png', 'slide3.png', 'slide4.png']

for img_name in images:
    input_path = os.path.join(image_dir, img_name)
    output_path = os.path.join(image_dir, f'nobg_{img_name}')
    
    print(f"Processing {input_path}...")
    try:
        input_image = Image.open(input_path)
        output_image = remove(input_image)
        output_image.save(output_path)
        print(f"Saved {output_path}")
    except Exception as e:
        print(f"Failed to process {input_path}: {e}")
