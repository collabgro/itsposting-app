import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function StudioRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/media?tab=studio'); }, []);
  return null;
}

export async function getServerSideProps() { return { props: {} }; }
