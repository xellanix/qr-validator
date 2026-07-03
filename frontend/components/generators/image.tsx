import { memo } from "react";

export const ImageFormat = memo(function ImageFormat({ value }: { value: string }) {
    return (
        <img src={value} alt="Foto" className="h-full min-h-64 w-7/10 min-w-42 object-contain" />
    );
});
