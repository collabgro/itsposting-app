import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function VideoWizardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/wizard'); }, []);
  return null;
}
