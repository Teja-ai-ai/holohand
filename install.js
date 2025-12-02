const fs = require('fs');
const path = require('path');

// THE FILE CONTENT MAP
const files = {
  'package.json': `{
  "name": "holohand-business",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.99.0",
    "@sanity/client": "^6.10.0",
    "framer-motion": "^10.18.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1"
  }
}`,

  'netlify.toml': `# Netlify Configuration
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
`,

  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        holo: {
          500: '#00f3ff',
          900: '#001a1d',
        }
      },
    },
  },
  plugins: [],
}`,

  'postcss.config.js': `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,

  '.env.local': `NEXT_PUBLIC_CMS_PROJECT_ID=mock_id
NEXT_PUBLIC_CMS_DATASET=production`,

  'lib/cms.js': `import { createClient } from '@sanity/client';

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_CMS_PROJECT_ID || 'mock_id',
  dataset: process.env.NEXT_PUBLIC_CMS_DATASET || 'production',
  useCdn: true,
  apiVersion: '2023-05-03',
  token: process.env.NEXT_PUBLIC_SANITY_READ_TOKEN
});

const MOCK_DATA = {
  newsletters: [
    { _id: '1', title: 'Q4 Market Insights', excerpt: 'Deep dive into emerging tech trends.', url: '#' },
    { _id: '2', title: 'The AI Revolution', excerpt: 'How Generative AI is changing B2B.', url: '#' },
  ],
  ebooks: [
    { _id: '3', title: 'Future of Holography', excerpt: 'Download our whitepaper.', url: '#' }
  ]
};

export async function fetchBusinessContent() {
  if (process.env.NEXT_PUBLIC_CMS_PROJECT_ID === 'mock_id') {
    return MOCK_DATA;
  }
  try {
    const data = await client.fetch(\`{
      "newsletters": *[_type == "newsletter"] | order(_createdAt desc)[0..2] {
        _id, title, excerpt, "url": url.current
      },
      "ebooks": *[_type == "ebook"] | order(_createdAt desc)[0..1] {
        _id, title, excerpt, "url": file.asset->url
      }
    }\`);
    return data;
  } catch (error) {
    console.error("CMS Fetch Error:", error);
    return MOCK_DATA;
  }
}`,

  'styles/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: #000;
  color: #fff;
  overflow: hidden;
}
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`,

  'pages/_document.js': `import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" async></script>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js" async></script>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" async></script>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js" async></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}`,

  'pages/_app.js': `import '@/styles/globals.css';
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}`,

  'components/HandDetector.jsx': `import React, { useRef, useEffect, useState } from 'react';

const HandDetector = ({ onTrigger, isPaused }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Initializing...");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const lastHandRef = useRef(null);
  const steadyStartTimeRef = useRef(0);
  const triggeredRef = useRef(false);
  const STEADY_THRESHOLD = 0.05;
  const TIME_TO_TRIGGER = 700;

  useEffect(() => {
    let hands;
    let camera;

    const onResults = (results) => {
      if (isPaused) return;
      const canvasCtx = canvasRef.current?.getContext('2d');
      if (!canvasCtx || !canvasRef.current) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        if (window.drawConnectors && window.drawLandmarks) {
          window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, { color: '#00f3ff', lineWidth: 2 });
          window.drawLandmarks(canvasCtx, landmarks, { color: '#ff0000', lineWidth: 1 });
        }
        let sumX = 0, sumY = 0;
        landmarks.forEach(lm => { sumX += lm.x; sumY += lm.y; });
        const centerX = sumX / landmarks.length;
        const centerY = sumY / landmarks.length;
        checkSteadiness(centerX, centerY, landmarks);
      } else {
        setStatus("No hand detected");
        resetSteadiness();
      }
      canvasCtx.restore();
    };

    const checkSteadiness = (x, y, landmarks) => {
      if (triggeredRef.current) return;
      const now = Date.now();
      if (lastHandRef.current) {
        const dx = Math.abs(x - lastHandRef.current.x);
        const dy = Math.abs(y - lastHandRef.current.y);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < STEADY_THRESHOLD) {
          if (steadyStartTimeRef.current === 0) steadyStartTimeRef.current = now;
          const elapsed = now - steadyStartTimeRef.current;
          const progress = Math.min(elapsed / TIME_TO_TRIGGER, 1);
          setStatus(\`Holding... \${Math.floor(progress * 100)}%\`);
          if (elapsed > TIME_TO_TRIGGER) {
             triggeredRef.current = true;
             setStatus("ANALYZING...");
             let fingers = 0;
             if (landmarks[8].y < landmarks[6].y) fingers++;
             if (landmarks[12].y < landmarks[10].y) fingers++;
             if (landmarks[16].y < landmarks[14].y) fingers++;
             if (landmarks[20].y < landmarks[18].y) fingers++;
             onTrigger({ fingers, handedness: 'Right', confidence: 0.98 });
          }
        } else {
          resetSteadiness(x, y);
          setStatus("Hold hand steady");
        }
      } else {
        resetSteadiness(x, y);
      }
      if(lastHandRef.current) lastHandRef.current = { x, y };
      else lastHandRef.current = { x, y };
    };

    const resetSteadiness = (x = null, y = null) => {
      steadyStartTimeRef.current = 0;
      if (x !== null) lastHandRef.current = { x, y };
      else lastHandRef.current = null;
    };

    const initMediaPipe = async () => {
      if (!window.Hands) { setTimeout(initMediaPipe, 100); return; }
      hands = new window.Hands({ locateFile: (file) => \`https://cdn.jsdelivr.net/npm/@mediapipe/hands/\${file}\` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      if (videoRef.current) {
        camera = new window.Camera(videoRef.current, {
          onFrame: async () => { if (videoRef.current && !isPaused) await hands.send({ image: videoRef.current }); },
          width: 640, height: 480
        });
        try { await camera.start(); setPermissionGranted(true); setStatus("Waiting for hand..."); } 
        catch (e) { console.error(e); setStatus("Camera permission denied"); }
      }
    };
    initMediaPipe();
    return () => { if (camera) camera.stop(); if (hands) hands.close(); };
  }, [isPaused, onTrigger]);

  useEffect(() => {
    if (!isPaused) { triggeredRef.current = false; setStatus("Waiting for hand..."); }
  }, [isPaused]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} width={640} height={480} className="absolute w-full h-full object-cover transform -scale-x-100 opacity-60" />
      <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none">
        <div className="inline-block px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-holo-500/30 text-holo-500 font-mono text-sm shadow-[0_0_15px_rgba(0,243,255,0.2)]">
          STATUS: {status.toUpperCase()}
        </div>
      </div>
      {!permissionGranted && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-6 text-center z-50">
          <h2 className="text-2xl font-bold text-white mb-2">Camera Access Required</h2>
        </div>
      )}
    </div>
  );
};
export default HandDetector;`,

  'components/HologramOverlay.jsx': `import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Torus, Icosahedron } from '@react-three/drei';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const HoloObject = () => {
  const meshRef = useRef();
  useFrame((state, delta) => {
    if (meshRef.current) { meshRef.current.rotation.x += delta * 0.2; meshRef.current.rotation.y += delta * 0.5; }
  });
  return (
    <group>
      <Icosahedron ref={meshRef} args={[1.5, 0]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#00f3ff" wireframe emissive="#00f3ff" emissiveIntensity={0.5} transparent opacity={0.8} />
      </Icosahedron>
      <Torus args={[2.5, 0.02, 16, 100]} rotation={[1.5, 0, 0]}><meshBasicMaterial color="#00f3ff" transparent opacity={0.3} /></Torus>
    </group>
  );
};

const ContentPanel = ({ data }) => (
  <div className="h-full flex flex-col gap-6">
    <div>
      <h3 className="text-holo-500 text-xs font-bold tracking-widest mb-3 uppercase border-b border-holo-500/30 pb-1">Latest Insights</h3>
      <div className="space-y-4">
        {data.newsletters.map((item) => (
          <a key={item._id} href={item.url} target="_blank" rel="noreferrer" className="block group cursor-pointer">
            <div className="text-white font-semibold group-hover:text-holo-500 transition-colors">{item.title}</div>
            <div className="text-gray-400 text-sm line-clamp-2">{item.excerpt}</div>
          </a>
        ))}
      </div>
    </div>
    <div>
      <h3 className="text-holo-500 text-xs font-bold tracking-widest mb-3 uppercase border-b border-holo-500/30 pb-1">Premium Ebooks</h3>
      <div className="space-y-4">
        {data.ebooks.map((item) => (
          <a key={item._id} href={item.url} target="_blank" rel="noreferrer" className="block p-3 border border-white/10 rounded hover:bg-white/5 transition-colors">
            <div className="text-white font-medium">{item.title}</div>
            <div className="text-xs text-holo-500 mt-1">Download PDF &rarr;</div>
          </a>
        ))}
      </div>
    </div>
  </div>
);

const HologramOverlay = ({ detectedData, onClose, content }) => {
  const isGood = detectedData.fingers >= 3;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,243,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="relative w-full max-w-6xl h-[80vh] flex flex-col md:flex-row border border-holo-500/20 bg-black/50 rounded-lg overflow-hidden shadow-[0_0_50px_rgba(0,243,255,0.1)]">
        <div className="w-full md:w-1/2 relative h-1/2 md:h-full border-b md:border-b-0 md:border-r border-holo-500/20">
          <div className="absolute top-4 left-4 z-10 text-xs font-mono text-holo-500">
            <div>CONFIDENCE: {(detectedData.confidence * 100).toFixed(0)}%</div>
            <div>FINGERS DETECTED: {detectedData.fingers}</div>
          </div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
             <h1 className={clsx("text-4xl font-bold tracking-tighter text-center shadow-black drop-shadow-lg", isGood ? "text-white" : "text-red-400")}>
               {isGood ? "YOU ARE GOOD" : "KEEP TRYING"}
             </h1>
          </div>
          <Canvas camera={{ position: [0, 0, 5] }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#00f3ff" />
            <HoloObject />
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
          </Canvas>
        </div>
        <div className="w-full md:w-1/2 p-8 relative overflow-y-auto">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">X</button>
          <div className="mb-8">
            <h2 className="text-2xl font-light text-white mb-1">Analysis Complete</h2>
            <div className="h-0.5 w-12 bg-holo-500 mb-4"></div>
          </div>
          {isGood ? <ContentPanel data={content} /> : <div className="text-gray-500">Locked. Please show 3+ fingers.</div>}
        </div>
      </div>
      <div className="absolute bottom-8 text-center text-gray-600 text-xs font-mono">PRESS [ESC] TO CLOSE</div>
    </motion.div>
  );
};
export default HologramOverlay;`,

  'pages/holo.js': `import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import HandDetector from '../components/HandDetector';
import HologramOverlay from '../components/HologramOverlay';
import { fetchBusinessContent } from '../lib/cms';
import { AnimatePresence } from 'framer-motion';

export async function getServerSideProps() {
  const content = await fetchBusinessContent();
  return { props: { content } };
}

export default function HoloPage({ content }) {
  const router = useRouter();
  const [triggered, setTriggered] = useState(false);
  const [detectionData, setDetectionData] = useState(null);

  const handleTrigger = (data) => {
    if (!triggered) { setDetectionData(data); setTriggered(true); }
  };
  const handleClose = () => { setTriggered(false); setDetectionData(null); };

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <>
      <Head><title>HoloHand</title></Head>
      <main className="relative w-screen h-screen bg-black overflow-hidden">
        <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
          <div className="text-white font-bold tracking-widest text-xl">HOLO<span className="text-holo-500">HAND</span></div>
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white text-sm uppercase tracking-wider">Exit</button>
        </div>
        <HandDetector onTrigger={handleTrigger} isPaused={triggered} />
        <AnimatePresence>{triggered && detectionData && (<HologramOverlay detectedData={detectionData} content={content} onClose={handleClose} />)}</AnimatePresence>
      </main>
    </>
  );
}`,

  'pages/index.js': `import Head from 'next/head';
import Link from 'next/link';
export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-holo-500 selection:text-black">
      <Head><title>HoloHand | Touchless BI</title></Head>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-holo-900/20 via-black to-black" />
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
          The Future of <br /><span className="text-holo-500">Touchless Analytics</span>
        </h1>
        <Link href="/holo" className="px-8 py-4 bg-transparent border border-holo-500 text-holo-500 font-bold uppercase tracking-widest hover:bg-holo-500 hover:text-black transition-colors">Initialize Scanner</Link>
      </main>
    </div>
  );
}`
};

// GENERATOR LOGIC
Object.entries(files).forEach(([filePath, content]) => {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Created:', filePath);
});
console.log('✅ Project generated successfully!');