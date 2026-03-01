import { useSettings } from "../stores/settings";


function checkImageExists(url: string) {
  try {
    const http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status != 404;
  } catch (err) {
    return false;
  } 
}

export default function getImageType(image: string | undefined) {
  if (!image) return false;
  const itemImgPath = useSettings.getState().itemImgPath;
  const is_link = image && typeof image === 'string' && (image.startsWith('https') || image.startsWith('nui://'));
  const is_inv_image = image && typeof image === 'string' && !image.startsWith('https') && !image.startsWith('nui://') && !image.includes('.');
  const is_icon = image && typeof image === 'string' && !image.startsWith('https') && !image.includes('.');

  if (is_link) {
    return {
      type: 'image',
      path: `${image}`,
    };
  }

  if (is_icon) {
    return {
      type: 'icon',
      path: image,
    };
  }

  if (is_inv_image) {
    console.log(`[getImageType] Checking for image: ${image}`);
    const extensions = ['.png', '.webp', '.jpg']; // Add more as needed
    for (const ext of extensions) {
      const fullPath = `${itemImgPath}${image}${ext}`;
  
      const exists = checkImageExists(fullPath);
      if (exists) {
        console.log(`[getImageType] Image found: ${image}`);
        return {
          type: 'image',
          path: fullPath,
        };
      }
    }
    console.log(`[getImageType] Image not found: ${image}`);
    return {
      type: 'unknown',
      path: '',
    };
  }

  return {
    type: 'unknown',
    path: '',
  };
}
