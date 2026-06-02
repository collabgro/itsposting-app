import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Profile() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings'); }, []);
  return null;
}
