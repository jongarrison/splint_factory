import { headers } from 'next/headers';
import PublicLanding from '@/components/landing/PublicLanding';
import ElectronLanding from '@/components/landing/ElectronLanding';

const splintFactoryIndicator = 'splintFactoryElectron';

export default async function Home() {
  // No need to check authentication here - middleware handles it
  
  // Check if request is from Electron
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  console.log('🏠 HOME PAGE - User-Agent:', userAgent);
  
  // Check for middleware debug headers
  const middlewareAuth = headersList.get('x-middleware-auth') || 'not-set';
  const middlewareStatus = headersList.get('x-middleware-status') || 'not-set';
  console.log('🔍 MIDDLEWARE HEADERS - Auth:', middlewareAuth, 'Status:', middlewareStatus);
  
  const isElectron = userAgent.includes(splintFactoryIndicator);
  
  // Alternative: Check for custom headers
  // const clientType = headersList.get('x-client-type');
  // const isElectron = clientType === 'electron';
  
  if (isElectron) {
    console.log('Detected Electron client');
    return <ElectronLanding />;
  } else {
    console.log('Detected web client');
    return <PublicLanding />;
  }
}
