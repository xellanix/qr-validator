import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

interface PaginationControllerProps {
    currentPage: number;
    totalPages: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}
export function PaginationController({
    currentPage,
    totalPages,
    setCurrentPage,
}: PaginationControllerProps) {
    const goToNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    const goToPreviousPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    return (
        <div className="flex items-center justify-end gap-x-2">
            <span className="text-muted-foreground text-sm">
                Page {currentPage} of {totalPages}
            </span>
            <Button
                variant="outline"
                size="icon-sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                aria-label="Previous"
            >
                <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <Button
                variant="outline"
                size="icon-sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                aria-label="Next"
            >
                <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
        </div>
    );
}
