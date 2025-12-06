'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'simple-keyboard/build/css/index.css';

export default function VirtualKeyboard() {
  const [isElectron, setIsElectron] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [KeyboardClass, setKeyboardClass] = useState<any>(null);
  const keyboardRef = useRef<any>(null);
  const currentInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    import('simple-keyboard').then((module) => {
      setKeyboardClass(() => module.default);
    });
  }, []);

  const containerRef = useCallback((element: HTMLDivElement | null) => {
    if (!element || keyboardRef.current || !KeyboardClass) return;

    const keyboard = new KeyboardClass('.virtual-keyboard', {
        onChange: (input: string) => {
          if (currentInputRef.current) {
            const element = currentInputRef.current;
            const isTextarea = element.tagName === 'TEXTAREA';
            
            // Get the correct prototype based on element type
            const prototype = isTextarea 
              ? window.HTMLTextAreaElement.prototype 
              : window.HTMLInputElement.prototype;
            
            const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            
            if (nativeValueSetter) {
              nativeValueSetter.call(element, input);
            } else {
              element.value = input;
            }
            
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            element.dispatchEvent(inputEvent);
            element.dispatchEvent(changeEvent);
            element.focus();
          }
        },
        onKeyPress: (button: string) => {
          if (button === '{shift}' || button === '{lock}') {
            const currentLayout = keyboard.options.layoutName;
            const newLayout = currentLayout === 'default' ? 'shift' : 'default';
            keyboard.setOptions({
              layoutName: newLayout
            });
          } else if (button === '{enter}') {
            if (currentInputRef.current) {
              currentInputRef.current.blur();
            }
          }
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

      // Prevent keyboard buttons from causing blur
      const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.virtual-keyboard')) {
          e.preventDefault(); // Prevent input from losing focus
        }
      };

      // Handle input blur - hide keyboard only when clicking truly outside
      const handleBlur = (e: FocusEvent) => {
        setTimeout(() => {
          // Only hide if no input is focused
          if (document.activeElement?.tagName !== 'INPUT' && 
              document.activeElement?.tagName !== 'TEXTAREA') {
            setIsVisible(false);
            currentInputRef.current = null;
          }
        }, 100);
      };

      // Handle keyboard toggle button
      const handleToggle = () => {
        const newVisibility = !isVisible;
        setIsVisible(newVisibility);
        
        // If showing keyboard and no input is focused, focus the first input on page
        if (newVisibility && !currentInputRef.current) {
          const firstInput = document.querySelector('input:not([type="hidden"]), textarea') as HTMLInputElement | HTMLTextAreaElement;
          if (firstInput) {
            firstInput.focus();
            currentInputRef.current = firstInput;
            keyboard.setInput(firstInput.value);
          }
        }
      };

      // Attach event listeners
      document.addEventListener('focusin', handleFocus);
      document.addEventListener('focusout', handleBlur);
      document.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('toggle-keyboard', handleToggle);

      // Cleanup function
      return () => {
        document.removeEventListener('focusin', handleFocus);
        document.removeEventListener('focusout', handleBlur);
        document.removeEventListener('mousedown', handleMouseDown);
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

      {/* Keyboard styling - target the actual span elements with text */}
      <style dangerouslySetInnerHTML={{__html: `
        .virtual-keyboard .simple-keyboard {
          background-color: transparent !important;
        }
        .virtual-keyboard .hg-button {
          height: 50px !important;
          font-size: 16px !important;
          background: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .virtual-keyboard .hg-button span {
          color: black !important;
        }
        .virtual-keyboard .hg-button:active {
          background: rgba(59, 130, 246, 0.5) !important;
        }
      `}} />
    </>
  );
}
