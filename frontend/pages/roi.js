import { useEffect } from 'react';
import { useRouter } from 'next/router';
export default function ROI() {
  const router = useRouter();
  useEffect(() => { router.replace('/analytics'); }, []);
  return null;
}
