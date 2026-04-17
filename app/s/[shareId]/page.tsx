import { StudioShell } from "@/components/studio/StudioShell";

interface Props {
	params: Promise<{ shareId: string }>;
}

export default async function SharePage({ params }: Props) {
	const { shareId } = await params;
	return <StudioShell shareId={shareId} />;
}
