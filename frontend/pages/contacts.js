import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Contacts() {
  const router = useRouter();
  useEffect(() => { router.replace('/inbox'); }, []);
  return null;
}
