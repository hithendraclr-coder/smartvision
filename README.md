# Smart Vision – GitHub Pages Browser Version

Upload these files to the root of a GitHub repository and enable GitHub Pages:
- `index.html`
- `style.css`
- `app.js`
- `README.md`

## Publish
Repository → Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save.
Open the HTTPS Pages URL after deployment.

## Features
- Browser-based common-object detection with TensorFlow.js and COCO-SSD.
- Spoken object names using browser text-to-speech.
- Larger 16:10 camera preview.
- Normal (non-mirrored) preview by default, with optional mirror preview.
- Camera selector (when multiple cameras are available).
- Full-screen camera view and snapshot download.
- English, Telugu, or Hindi speech selection (availability depends on voices installed in the browser/device).
- Voice speed and detection sensitivity controls.
- Voice ON/OFF and test voice buttons.

## Use
Open the HTTPS Pages URL in Chrome or Edge. Press Start, allow camera permission, and show objects to the camera. The model downloads on first use, so internet is required.

## Important limitations
This browser app is a prototype. COCO-SSD supports a limited set of common object categories, not every object. It may miss or misidentify objects and does not reliably estimate distance, identify medicines, or provide obstacle avoidance. Do not use it as a blind person's sole mobility or safety aid. Test with a sighted helper and continue using established mobility aids.
