'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Check if WebGL is available on this device
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl instanceof WebGLRenderingContext;
  } catch {
    return false;
  }
}

interface StlViewerProps {
  url: string;
  width?: number | string;
  height?: number | string;
  backgroundColor?: string;
  modelColor?: string;
  className?: string;
}

/**
 * Simple, reusable STL viewer component using Three.js
 * 
 * Features:
 * - Loads and displays STL files
 * - Orbit controls (rotate, pan, zoom)
 * - Auto-centers and scales model
 * - Responsive sizing
 * 
 * Future extensibility points:
 * - Add props for lighting configuration
 * - Add props for camera position
 * - Add measurement tools
 * - Add editing capabilities
 */
export default function StlViewer({
  url,
  width = '100%',
  height = 400,
  backgroundColor = '#f3f4f6',
  modelColor = '#3b82f6',
  className = '',
}: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);
  
  // Store Three.js objects for cleanup
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check WebGL support on mount
  useEffect(() => {
    setWebGLSupported(checkWebGLSupport());
  }, []);

  useEffect(() => {
    // Skip if WebGL not supported or not yet checked
    if (webGLSupported === null || webGLSupported === false) return;
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = typeof height === 'number' ? height : container.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // Camera setup with Z-up orientation
    const camera = new THREE.PerspectiveCamera(
      45,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    camera.up.set(0, 0, 1); // Set Z axis as up
    camera.position.set(0, 0, 100);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit controls with origin as target
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0); // Set orbit center to origin
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);

    // Load STL
    const loader = new STLLoader();
    loader.load(
      url,
      (geometry) => {
        // Center geometry
        geometry.center();

        // Create material and mesh
        const material = new THREE.MeshPhongMaterial({
          color: modelColor,
          specular: 0x111111,
          shininess: 200,
        });
        const mesh = new THREE.Mesh(geometry, material);

        // Calculate bounding box and scale to fit view
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox!;
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Position camera to view entire model with Z-up orientation
        const fov = camera.fov * (Math.PI / 180);
        const cameraDistance = maxDim / (2 * Math.tan(fov / 2));
        // Position camera at an angle viewing from above with Z as up
        camera.position.set(cameraDistance * 0.7, cameraDistance * 0.7, cameraDistance * 0.7);
        camera.up.set(0, 0, 1); // Ensure camera's up vector is Z
        camera.lookAt(0, 0, 0);
        
        // Update controls target
        controls.target.set(0, 0, 0);
        controls.update();

        scene.add(mesh);
        setLoading(false);
      },
      (progress) => {
        // Optional: track loading progress
        // console.log((progress.loaded / progress.total) * 100 + '% loaded');
      },
      (error) => {
        console.error('Error loading STL:', error);
        setError('Failed to load 3D model');
        setLoading(false);
      }
    );

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      
      const newWidth = container.clientWidth;
      const newHeight = typeof height === 'number' ? height : container.clientHeight;
      
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (container && rendererRef.current.domElement.parentElement === container) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
      
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            }
          }
        });
      }
    };
  }, [url, height, backgroundColor, modelColor, webGLSupported]);

  // Show fallback if WebGL is not supported
  if (webGLSupported === false) {
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        <div className="w-full h-full rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center">
          <div className="text-center text-gray-300 px-4">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm font-medium">3D Preview Unavailable</p>
            <p className="text-xs mt-1 opacity-75">This device does not support 3D rendering</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
      
      {loading && webGLSupported && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Loading 3D model...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center text-red-600">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      
      {!loading && !error && webGLSupported && (
        <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 px-3 py-2 rounded text-xs text-gray-600">
          Drag to rotate - Scroll to zoom - Right-click to pan
        </div>
      )}
    </div>
  );
}
