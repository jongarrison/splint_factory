# StlViewer Component

Simple, reusable Three.js-based STL/3MF viewer for React/Next.js.

## Usage

```tsx
import StlViewer from '@/components/StlViewer';

<StlViewer 
  url="/api/geometry-jobs/abc123/geometry-file"
  fileName="abc123.3mf"
  height={500}
  modelColor="#3b82f6"
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | *required* | URL to the mesh file (STL or 3MF) |
| `fileName` | `string` | `undefined` | Optional filename hint (recommended for extension-less API URLs) |
| `width` | `number \| string` | `'100%'` | Container width |
| `height` | `number \| string` | `400` | Container height in pixels |
| `backgroundColor` | `string` | `'#f3f4f6'` | Scene background color |
| `modelColor` | `string` | `'#3b82f6'` | Model color (hex) |
| `className` | `string` | `''` | Additional CSS classes |

## Controls

- **Left-click + drag**: Rotate model
- **Right-click + drag**: Pan camera
- **Scroll wheel**: Zoom in/out

## Features

- ✅ Auto-centers and scales models
- ✅ Responsive sizing
- ✅ Loading states
- ✅ Error handling
- ✅ Proper cleanup on unmount
- ✅ Multiple light sources for good visibility

## Future Extensions

The component is designed for future enhancement:

- Add measurement tools
- Add cross-section views
- Add editing capabilities
- Add texture/material options
- Add export options
- Add annotation tools
- Add comparison mode (overlay multiple models)

## Implementation Notes

- Uses Three.js for WebGL rendering
- Uses OrbitControls for camera interaction
- Uses STLLoader and 3MFLoader for file parsing
- Cleans up all Three.js resources on unmount to prevent memory leaks
