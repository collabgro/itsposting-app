import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ApprovalsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/history'); }, []);
  return null;
}
