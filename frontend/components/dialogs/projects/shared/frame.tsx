import { BreadcrumbItem, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

interface BreadcrumbPairProps {
    index: number;
    breadcrumb: React.ReactNode;
    length: number;
}
export function BreadcrumbPair({ index, breadcrumb, length }: BreadcrumbPairProps) {
    const isLast = index === length - 1;

    if (isLast) {
        return (
            <BreadcrumbItem>
                <BreadcrumbPage>{breadcrumb}</BreadcrumbPage>
            </BreadcrumbItem>
        );
    }

    return (
        <>
            <BreadcrumbItem>{breadcrumb}</BreadcrumbItem>
            <BreadcrumbSeparator />
        </>
    );
}

interface FrameProps {
    children: React.ReactNode;
}

export function FrameContainer({ children }: FrameProps) {
    return <div className="flex flex-col gap-4 py-4">{children}</div>;
}

export function FrameHeader({ children }: FrameProps) {
    return <div className="flex flex-col gap-2">{children}</div>;
}

export function FrameDescription({ children }: FrameProps) {
    return <p className="text-muted-foreground text-sm">{children}</p>;
}
