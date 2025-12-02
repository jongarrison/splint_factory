'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'simple-keyboard/build/css/index.css';

/**
 * Virtual Keyboard Component
 * Only initializes when running in Electron environment (kiosk mode)
 * Automatically attaches to all input and textarea elements
 */
export default function VirtualKeyboard() {
  const [isElectron, setIsElectron] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [KeyboardClass, setKeyboardClass] = useState<any>(null);
  const keyboardRef = useRef<any>(null);
  const currentInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Load Keyboard class dynamically
  useEffect(() => {
    import('simple-keyboard').then((module) => {
      setKeyboardClass(() => module.default);
    });
  }, []);

  // Callback ref that initializes keyboard when DOM element is mounted
  const containerRef = useCallback((element: HTMLDivElement | null) => {
    if (!element || keyboardRef.current || !KeyboardClass) return;

    // Initialize keyboard now that the DOM element exists
    const keyboard = new KeyboardClass('.virtual-keyboard', {
        onChange: (input: string) => {
          if (currentInputRef.current) {
            currentInputRef.current.value = input;
            // Trigger input event for React forms
            const event = new Event('input', { bubbles: true });
            currentInputRef.current.dispatchEvent(event);
          }
        },
        onKeyPress: (button: string) => {
          // Handle special keys
          if (button === '{shift}' || button === '{lock}') {
            const currentLayout = keyboard.options.layoutName;
            const newLayout = currentLayout === 'default' ? 'shift' : 'default';
            keyboard.setOptions({
              layoutName: newLayout
            });
          } else if (button === '{enter}') {
            // Blur current input (hide keyboard)
            if (currentInputRef.current) {
              currentInputRef.current.blur();
            }
          }
        },
        theme: 'hg-theme-default hg-theme-ios',
        layout: {
          default: [
            '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
            '{tab} q w e r t y u i o p [ ] \\',
            "{lock} a s d f g h j k l ; ' {enter}",
            '{shift} z x c v b n m , . / {shift}',
            '.com @ {space}'
          ],
          shift: [
            '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
            '{tab} Q W E R T Y U I O P { } |',
            '{lock} A S D F G H J K L : " {enter}',
            '{shift} Z X C V B N M < > ? {shift}',
            '.com @ {space}'
          ]
        },
        display: {
          '{bksp}': '⌫',
          '{enter}': '↵',
          '{shift}': '⇧',
          '{tab}': '⇥',
          '{lock}': '⇪',
          '{space}': '___________________'
        }
      });

      keyboardRef.current = keyboard;

      // Handle input focus - show keyboard
      const handleFocus = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          currentInputRef.current = target as HTMLInputElement | HTMLTextAreaElement;
          keyboard.setInput(currentInputRef.current.value);
          setIsVisible(true);
        }
      };

      // Handle input blur - hide keyboard after a delay (to allow clicks on keyboard)
      const handleBlur = () => {
        setTimeout(() => {
          // Only hide if no input is focused
          if (document.activeElement?.tagName !== 'INPUT' && 
              document.activeElement?.tagName !== 'TEXTAREA') {
            setIsVisible(false);
            currentInputRef.current = null;
          }
        }, 200);
      };

      // Handle keyboard toggle button
      const handleToggle = () => {
        setIsVisible(prev => !prev);
      };

      // Attach event listeners
      document.addEventListener('focusin', handleFocus);
      document.addEventListener('focusout', handleBlur);
      window.addEventListener('toggle-keyboard', handleToggle);

      // Cleanup function
      return () => {
        document.removeEventListener('focusin', handleFocus);
        document.removeEventListener('focusout', handleBlur);
        window.removeEventListener('toggle-keyboard', handleToggle);
        if (keyboard) {
          keyboard.destroy();
        }
      };
  }, [KeyboardClass]);

  useEffect(() => {
    // Only run in Electron environment
    const checkElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
    setIsElectron(checkElectron);
  }, []);

  // Don't render anything if not in Electron
  if (!isElectron) return null;

  return (
    <>
      {/* Keyboard container */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          boxShadow: '0 -4px 6px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="virtual-keyboard max-w-6xl mx-auto p-4" ref={containerRef}></div>
      </div>

      {/* Global styles for keyboard */}
      <style jsx global>{`
        .simple-keyboard {
          background-color: transparent !important;
        }
        .simple-keyboard .hg-button {
          height: 50px;
          font-size: 18px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.3);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }
        .simple-keyboard .hg-button:active {
          background: rgba(59, 130, 246, 0.7);
          color: #ffffff;
        }
        .simple-keyboard .hg-button-space {
          width: 60%;
        }
      `}</style>
    </>
  );
}
