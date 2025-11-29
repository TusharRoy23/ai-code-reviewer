import { z, string } from "zod";

export const ReviewPayloadDto = z.object({
    code: string({ error: "Code is required." })
});

export type ReviewPayloadType = z.infer<typeof ReviewPayloadDto>;