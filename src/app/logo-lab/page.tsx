'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

// Widely supported web-safe and system fonts
const FONTS = [
  'Arial',
  'Arial Black',
  'Courier New',
  'Georgia',
  'Helvetica',
  'Impact',
  'Lucida Console',
  'Palatino Linotype',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Garamond',
  'Brush Script MT',
  'Copperplate',
  'Futura',
  'Gill Sans',
  'Optima',
  'Rockwell',
  'system-ui',
  'monospace',
  'sans-serif',
  'serif',
];

// Convert HSV to RGB then to hex
function hsvToHex(h: number, s: number, v: number): string {
  const sNorm = s / 100;
  const vNorm = v / 100;
  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (val: number) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface HSV {
  h: number;
  s: number;
  v: number;
}

interface Preset {
  name: string;
  hsv: HSV;
}

const BLUE_PRESETS: Preset[] = [
  { name: 'Royal', hsv: { h: 225, s: 73, v: 57 } },
  { name: 'Navy', hsv: { h: 240, s: 100, v: 50 } },
  { name: 'Dodger', hsv: { h: 210, s: 88, v: 100 } },
  { name: 'Steel', hsv: { h: 207, s: 44, v: 71 } },
  { name: 'Cobalt', hsv: { h: 215, s: 100, v: 67 } },
  { name: 'Cerulean', hsv: { h: 198, s: 75, v: 82 } },
];

const ORANGE_PRESETS: Preset[] = [
  { name: 'Orange', hsv: { h: 39, s: 100, v: 100 } },
  { name: 'Tangerine', hsv: { h: 28, s: 85, v: 100 } },
  { name: 'Amber', hsv: { h: 45, s: 100, v: 100 } },
  { name: 'Burnt', hsv: { h: 25, s: 87, v: 80 } },
  { name: 'Coral', hsv: { h: 16, s: 69, v: 100 } },
  { name: 'Gold', hsv: { h: 51, s: 100, v: 100 } },
];

function HSVPicker({ label, value, onChange, presets }: {
  label: string;
  value: HSV;
  onChange: (hsv: HSV) => void;
  presets: Preset[];
}) {
  const hex = hsvToHex(value.h, value.s, value.v);
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#ccc' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          backgroundColor: hex, border: '2px solid #555',
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <label style={{ width: 14, fontSize: 12, color: '#999' }}>H</label>
            <input type="range" min={0} max={359} value={value.h}
              onChange={e => onChange({ ...value, h: Number(e.target.value) })}
              style={{ flex: 1 }} />
            <span style={{ width: 36, fontSize: 12, color: '#aaa', textAlign: 'right' }}>{value.h}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <label style={{ width: 14, fontSize: 12, color: '#999' }}>S</label>
            <input type="range" min={0} max={100} value={value.s}
              onChange={e => onChange({ ...value, s: Number(e.target.value) })}
              style={{ flex: 1 }} />
            <span style={{ width: 36, fontSize: 12, color: '#aaa', textAlign: 'right' }}>{value.s}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ width: 14, fontSize: 12, color: '#999' }}>V</label>
            <input type="range" min={0} max={100} value={value.v}
              onChange={e => onChange({ ...value, v: Number(e.target.value) })}
              style={{ flex: 1 }} />
            <span style={{ width: 36, fontSize: 12, color: '#aaa', textAlign: 'right' }}>{value.v}%</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#aaa', fontFamily: 'monospace' }}>
        CSS: <span style={{ color: hex, fontWeight: 600 }}>{hex}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {presets.map(p => {
          const pHex = hsvToHex(p.hsv.h, p.hsv.s, p.hsv.v);
          return (
            <button key={p.name} onClick={() => onChange(p.hsv)}
              title={p.name}
              style={{
                width: 36, height: 36, borderRadius: 6,
                backgroundColor: pHex, border: '2px solid #555',
                cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              }}>
              <span style={{ fontSize: 8, color: '#fff', textShadow: '0 0 3px #000, 0 0 3px #000', lineHeight: 1, paddingBottom: 2 }}>{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LogoLabPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Blue-centered: H=220, S=80, V=90
  const [primary, setPrimary] = useState<HSV>({ h: 220, s: 80, v: 90 });
  // Orange-centered: H=30, S=85, V=95
  const [secondary, setSecondary] = useState<HSV>({ h: 30, s: 85, v: 95 });
  const [font, setFont] = useState('Arial');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.push('/login');
    }
  }, [session, status, router]);

  const primaryHex = hsvToHex(primary.h, primary.s, primary.v);
  const secondaryHex = hsvToHex(secondary.h, secondary.s, secondary.v);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  if (status === 'loading') {
    return <div style={{ color: '#ccc', padding: 40 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 40, maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#ddd', marginBottom: 32, fontSize: 24 }}>Logo Lab</h1>

      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
        {/* Controls panel */}
        <div style={{ flex: '0 0 340px', minWidth: 280 }}>
          <HSVPicker label="sf-primary-color (Splint)" value={primary} onChange={setPrimary} presets={BLUE_PRESETS} />
          <HSVPicker label="sf-secondary-color (Factory)" value={secondary} onChange={setSecondary} presets={ORANGE_PRESETS} />

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#ccc' }}>Font Family</div>
            <select
              value={font}
              onChange={e => setFont(e.target.value)}
              style={{
                padding: '8px 12px', fontSize: 14, borderRadius: 6,
                backgroundColor: '#2a2a2a', color: '#ddd', border: '1px solid #555',
                width: '100%',
              }}
            >
              {FONTS.map(f => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#ccc' }}>CSS Values</div>
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column', fontSize: 13, fontFamily: 'monospace' }}>
              <button onClick={() => copyToClipboard(primaryHex)}
                style={{ background: 'none', border: '1px solid #555', borderRadius: 4, padding: '4px 8px', color: '#aaa', cursor: 'pointer', textAlign: 'left' }}>
                Primary: <span style={{ color: primaryHex }}>{primaryHex}</span>
              </button>
              <button onClick={() => copyToClipboard(secondaryHex)}
                style={{ background: 'none', border: '1px solid #555', borderRadius: 4, padding: '4px 8px', color: '#aaa', cursor: 'pointer', textAlign: 'left' }}>
                Secondary: <span style={{ color: secondaryHex }}>{secondaryHex}</span>
              </button>
              <button onClick={() => copyToClipboard(font)}
                style={{ background: 'none', border: '1px solid #555', borderRadius: 4, padding: '4px 8px', color: '#aaa', cursor: 'pointer', textAlign: 'left' }}>
                Font: {font}
              </button>
            </div>
          </div>
        </div>

        {/* Preview panels */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {/* White background preview */}
          <div style={{
            backgroundColor: '#ffffff', borderRadius: 12, padding: 40,
            marginBottom: 24, textAlign: 'center', border: '1px solid #333',
          }}>
            <span style={{ fontFamily: font, fontSize: 52, fontWeight: 700 }}>
              <span style={{ color: primaryHex }}>Splint</span>
              {' '}
              <span style={{ color: secondaryHex }}>Factory</span>
            </span>
          </div>

          {/* Black background preview */}
          <div style={{
            backgroundColor: '#000000', borderRadius: 12, padding: 40,
            marginBottom: 24, textAlign: 'center', border: '1px solid #333',
          }}>
            <span style={{ fontFamily: font, fontSize: 52, fontWeight: 700 }}>
              <span style={{ color: primaryHex }}>Splint</span>
              {' '}
              <span style={{ color: secondaryHex }}>Factory</span>
            </span>
          </div>

          {/* Primary text on secondary background */}
          <div style={{
            backgroundColor: secondaryHex, borderRadius: 12, padding: 40,
            marginBottom: 24, textAlign: 'center', border: '1px solid #333',
          }}>
            <span style={{ fontFamily: font, fontSize: 52, fontWeight: 700, color: primaryHex }}>
              Splint Factory
            </span>
          </div>

          {/* Secondary text on primary background */}
          <div style={{
            backgroundColor: primaryHex, borderRadius: 12, padding: 40,
            textAlign: 'center', border: '1px solid #333',
          }}>
            <span style={{ fontFamily: font, fontSize: 52, fontWeight: 700, color: secondaryHex }}>
              Splint Factory
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
