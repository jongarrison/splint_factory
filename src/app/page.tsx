import { headers } from 'next/headers';
import PublicLanding from '@/components/landing/PublicLanding';
import ElectronLanding from '@/components/landing/ElectronLanding';

const splintFactoryIndicator = 'splintFactoryElectron';

export default async function Home() {
  // No need to check authentication here - middleware handles it
  
  // Check if request is from Electron
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  const clientType = headersList.get('x-client-type') || '';
  
  console.log('🏠 HOME PAGE - User-Agent:', userAgent);
  console.log('🏠 HOME PAGE - X-Client-Type:', clientType);
  
  // Check for middleware debug headers
  const middlewareAuth = headersList.get('x-middleware-auth') || 'not-set';
  const middlewareStatus = headersList.get('x-middleware-status') || 'not-set';
  console.log('🔍 MIDDLEWARE HEADERS - Auth:', middlewareAuth, 'Status:', middlewareStatus);
  
  // Check both User-Agent and custom header for Electron detection
  const isElectronByUserAgent = userAgent.includes('splint_client') || userAgent.includes('Electron');
  const isElectronByHeader = clientType.includes(splintFactoryIndicator);
  const isElectron = isElectronByUserAgent || isElectronByHeader;
  
  if (isElectron) {
    const detectionMethod = isElectronByHeader ? 'X-Client-Type header' : 'User-Agent (splint_client/Electron)';
    console.log(`✅ Detected Electron client via: ${detectionMethod}`);
    return <ElectronLanding />;
  } else {
    console.log('🌐 Detected web client');
    return <PublicLanding />;
  }
}
