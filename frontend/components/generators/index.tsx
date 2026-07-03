import { ImageFormat } from "@/components/generators/image";
import { TextFormat } from "@/components/generators/text";

export const fieldBuilder = {
    text: (value: string) => <TextFormat key={value} value={value} />,
    image: (value: string) => <ImageFormat key={value} value={value} />,
};
