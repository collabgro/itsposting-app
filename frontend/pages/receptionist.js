import { useEffect } from 'react';
import { useRouter } from 'next/router';
export default function Receptionist() {
  const router = useRouter();
  useEffect(() => { router.replace('/knowledge-base?tab=ai-response'); }, []);
  return null;
}
