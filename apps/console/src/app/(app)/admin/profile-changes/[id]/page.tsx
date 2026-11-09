import { ProfileChangeDetail } from '@/components/admin/profile-changes';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfileChangeDetail id={id} />;
}
