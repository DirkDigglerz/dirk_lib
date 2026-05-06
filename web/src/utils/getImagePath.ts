import { useSettings } from "dirk-cfx-react";


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

function isRemoteUrl(s: string) {
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//');
}

export default function getImageType(image: string | undefined) {
  if (!image) return false;
  const itemImgPath = useSettings.getState().itemImgPath;
  const is_link = typeof image === 'string' && (isRemoteUrl(image) || image.startsWith('nui://'));
  const is_inv_image = typeof image === 'string' && !isRemoteUrl(image) && !image.startsWith('nui://') && !image.includes('.');
  const is_icon = typeof image === 'string' && !isRemoteUrl(image) && !image.includes('.');

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
    // For remote (CDN) itemImgPath, skip the synchronous HEAD probe — CORS
    // commonly blocks HEAD on CDN buckets, returning false-negatives even
    // when the image renders fine via <img>. Default to .png and let
    // <img onError> handle missing files.
    if (itemImgPath && isRemoteUrl(itemImgPath)) {
      const sep = itemImgPath.endsWith('/') ? '' : '/';
      return {
        type: 'image',
        path: `${itemImgPath}${sep}${image}.png`,
      };
    }

    const extensions = ['.png', '.webp', '.jpg'];
    for (const ext of extensions) {
      const fullPath = `${itemImgPath}${image}${ext}`;
      if (checkImageExists(fullPath)) {
        return {
          type: 'image',
          path: fullPath,
        };
      }
    }
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
