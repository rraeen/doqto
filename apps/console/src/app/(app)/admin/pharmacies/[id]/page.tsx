import { ProviderDetail } from '@/components/admin/provider-detail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProviderDetail kind="pharmacies" id={id} />;
}
